import json
import os
import re
import uuid
from werkzeug.utils import secure_filename
import bcrypt
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from psycopg import connect, errors
import traceback

load_dotenv() 
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', './uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_VIDEO = {'mp4', 'webm', 'mov'}
ALLOWED_IMAGE = {'jpg', 'jpeg', 'png', 'webp'}
MAX_VIDEO_MB  = 500
MAX_IMAGE_MB  = 10

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:1234@localhost:54869/luta_danca')


def get_connection():
    return connect(DATABASE_URL)


def ensure_users_table():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS usuarios (
                    id BIGSERIAL PRIMARY KEY,
                    nombre VARCHAR(120) NOT NULL,
                    email VARCHAR(180) NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    rol VARCHAR(20) NOT NULL DEFAULT 'alumno',
                    rango VARCHAR(40),
                    metodo_pago VARCHAR(30) NOT NULL DEFAULT 'tarjeta',
                    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
                    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute('CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)')
        conn.commit()
    finally:
        conn.close()


def ensure_forum_tables():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS foro_publicaciones (
                    id BIGSERIAL PRIMARY KEY,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    mensaje TEXT NOT NULL,
                    hashtags TEXT[] NOT NULL DEFAULT '{}',
                    imagen_url TEXT,
                    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                "ALTER TABLE foro_publicaciones ADD COLUMN IF NOT EXISTS imagen_url TEXT"
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS foro_likes (
                    id BIGSERIAL PRIMARY KEY,
                    post_id BIGINT NOT NULL REFERENCES foro_publicaciones(id) ON DELETE CASCADE,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE(post_id, usuario_id)
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS foro_respuestas (
                    id BIGSERIAL PRIMARY KEY,
                    post_id BIGINT NOT NULL REFERENCES foro_publicaciones(id) ON DELETE CASCADE,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    mensaje TEXT NOT NULL,
                    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS notificaciones (
                    id BIGSERIAL PRIMARY KEY,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    titulo TEXT NOT NULL,
                    mensaje TEXT NOT NULL,
                    tipo TEXT NOT NULL DEFAULT 'info',
                    prioridad TEXT NOT NULL DEFAULT 'normal',
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    leida BOOLEAN NOT NULL DEFAULT FALSE,
                    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute('CREATE INDEX IF NOT EXISTS idx_foro_publicaciones_usuario_id ON foro_publicaciones(usuario_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_foro_publicaciones_creado_en ON foro_publicaciones(creado_en)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_foro_likes_post_id ON foro_likes(post_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_foro_likes_usuario_id ON foro_likes(usuario_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_foro_respuestas_post_id ON foro_respuestas(post_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones(usuario_id, creado_en DESC)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida, creado_en DESC)')
        conn.commit()
    finally:
        conn.close()


ensure_users_table()
ensure_forum_tables()
def ensure_profesor_tables():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Videos instruccionales
            cur.execute("""
                CREATE TABLE IF NOT EXISTS prof_videos (
                    id          BIGSERIAL PRIMARY KEY,
                    profesor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    titulo      TEXT NOT NULL,
                    categoria   VARCHAR(60),
                    dificultad  VARCHAR(30) DEFAULT 'basico',
                    descripcion TEXT,
                    hashtags    TEXT[] NOT NULL DEFAULT '{}',
                    filename    TEXT NOT NULL,
                    filepath    TEXT NOT NULL,
                    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)

            # Imágenes técnicas
            cur.execute("""
                CREATE TABLE IF NOT EXISTS prof_imagenes (
                    id          BIGSERIAL PRIMARY KEY,
                    profesor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    titulo      TEXT NOT NULL,
                    tipo        VARCHAR(40) DEFAULT 'diagrama',
                    descripcion TEXT,
                    hashtags    TEXT[] NOT NULL DEFAULT '{}',
                    filename    TEXT NOT NULL,
                    filepath    TEXT NOT NULL,
                    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)

            # Instruccionales (cursos empaquetados)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS prof_instruccionales (
                    id          BIGSERIAL PRIMARY KEY,
                    profesor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    titulo      TEXT NOT NULL,
                    descripcion TEXT,
                    nivel       VARCHAR(40) DEFAULT 'principiante',
                    categoria   VARCHAR(60),
                    videos_ids  BIGINT[] NOT NULL DEFAULT '{}',
                    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)

            # Diagramas tácticos propios
            cur.execute("""
                CREATE TABLE IF NOT EXISTS prof_diagramas (
                    id          BIGSERIAL PRIMARY KEY,
                    profesor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    titulo      TEXT NOT NULL,
                    descripcion TEXT,
                    nodos       TEXT NOT NULL,
                    tipo        VARCHAR(60) DEFAULT 'arbol_decision',
                    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)

            # Índices
            for table, col in [
                ('prof_videos',        'profesor_id'),
                ('prof_imagenes',      'profesor_id'),
                ('prof_instruccionales','profesor_id'),
                ('prof_diagramas',     'profesor_id'),
            ]:
                cur.execute(
                    f'CREATE INDEX IF NOT EXISTS idx_{table}_{col} ON {table}({col})'
                )
        conn.commit()
    finally:
        conn.close()

ensure_profesor_tables()


def ensure_social_tables():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS seguimientos (
                    id BIGSERIAL PRIMARY KEY,
                    seguidor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    seguido_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE(seguidor_id, seguido_id)
                )
                """
            )
            cur.execute('CREATE INDEX IF NOT EXISTS idx_seguimientos_seguidor_id ON seguimientos(seguidor_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_seguimientos_seguido_id ON seguimientos(seguido_id)')

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS video_comentarios (
                    id BIGSERIAL PRIMARY KEY,
                    video_id BIGINT NOT NULL REFERENCES prof_videos(id) ON DELETE CASCADE,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    mensaje TEXT NOT NULL,
                    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute('CREATE INDEX IF NOT EXISTS idx_video_comentarios_video_id ON video_comentarios(video_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_video_comentarios_usuario_id ON video_comentarios(usuario_id)')
        conn.commit()
    finally:
        conn.close()

ensure_social_tables()


# ── Helper: verificar que el usuario es profesor ─────────────────
def _get_profesor(profesor_id):
    """Retorna la fila del usuario si existe y es profesor, sino None."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, nombre, rol FROM usuarios WHERE id = %s AND rol = 'profesor'",
                (profesor_id,)
            )
            return cur.fetchone()
    finally:
        conn.close()


def _allowed_file(filename, allowed_set):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    return ext in allowed_set


# ════════════════════════════════════════════════
#  VIDEOS
# ════════════════════════════════════════════════

@app.route('/api/profesor/videos', methods=['GET'])
def get_profesor_videos():
    """Lista los videos de un profesor."""
    profesor_id = request.args.get('profesor_id', type=int)
    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, titulo, categoria, dificultad, descripcion,
                       hashtags, filename, creado_en
                FROM prof_videos
                WHERE profesor_id = %s
                ORDER BY creado_en DESC
                """,
                (profesor_id,)
            )
            rows = cur.fetchall()
        conn.close()

        videos = [
            {
                'id':          r[0],
                'titulo':      r[1],
                'categoria':   r[2],
                'dificultad':  r[3],
                'descripcion': r[4],
                'hashtags':    r[5] or [],
                'filename':    r[6],
                'creado_en':   r[7].isoformat() if r[7] else None,
            }
            for r in rows
        ]
        return jsonify({'success': True, 'videos': videos})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/videos', methods=['POST'])
def upload_video():
    """
    Recibe un video vía multipart/form-data.
    Campos: profesor_id, titulo, categoria, dificultad, descripcion, hashtags
    Archivo: video (campo 'file')
    """
    profesor_id = request.form.get('profesor_id', type=int)
    titulo      = (request.form.get('titulo') or '').strip()
    categoria   = (request.form.get('categoria') or '').strip()
    dificultad  = (request.form.get('dificultad') or 'basico').strip()
    descripcion = (request.form.get('descripcion') or '').strip()
    raw_tags    = request.form.get('hashtags', '')
    hashtags    = [t.lower() for t in re.findall(r'#([A-Za-z0-9_]+)', raw_tags)]

    if not profesor_id or not titulo:
        return jsonify({'success': False, 'message': 'Faltan campos obligatorios'}), 400

    if not _get_profesor(profesor_id):
        return jsonify({'success': False, 'message': 'Usuario no es profesor'}), 403

    file = request.files.get('file')
    if not file or file.filename == '':
        return jsonify({'success': False, 'message': 'No se recibió ningún archivo'}), 400

    if not _allowed_file(file.filename, ALLOWED_VIDEO):
        return jsonify({'success': False, 'message': 'Formato de video no permitido'}), 400

    # Verificar tamaño leyendo los bytes (no confiar en Content-Length)
    file.stream.seek(0, 2)
    size_mb = file.stream.tell() / (1024 * 1024)
    file.stream.seek(0)
    if size_mb > MAX_VIDEO_MB:
        return jsonify({'success': False, 'message': f'El video supera los {MAX_VIDEO_MB} MB'}), 413

    ext      = file.filename.rsplit('.', 1)[-1].lower()
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    subfolder = os.path.join(UPLOAD_FOLDER, 'videos', str(profesor_id))
    os.makedirs(subfolder, exist_ok=True)
    filepath  = os.path.join(subfolder, safe_name)
    file.save(filepath)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prof_videos
                    (profesor_id, titulo, categoria, dificultad, descripcion, hashtags, filename, filepath)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id, creado_en
                """,
                (profesor_id, titulo, categoria, dificultad,
                 descripcion, hashtags, secure_filename(file.filename), filepath)
            )
            row = cur.fetchone()

            cur.execute(
                'SELECT seguidor_id FROM seguimientos WHERE seguido_id = %s',
                (profesor_id,)
            )
            followers = cur.fetchall()
            if followers:
                for follower in followers:
                    cur.execute(
                        "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, prioridad, metadata, leida) "
                        "VALUES (%s, %s, %s, %s, %s, %s::jsonb, FALSE)",
                        (
                            follower[0],
                            'Nuevo video disponible',
                            f'El profesor {profesor[1]} subió un nuevo video: {titulo}',
                            'video',
                            'normal',
                            json.dumps({'video_id': row[0], 'profesor_id': profesor_id}),
                        )
                    )

            conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'video': {
                'id':        row[0],
                'titulo':    titulo,
                'categoria': categoria,
                'creado_en': row[1].isoformat(),
            }
        }), 201

    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/videos/<int:video_id>', methods=['DELETE'])
def delete_video(video_id):
    """Elimina un video del profesor."""
    data        = request.get_json(silent=True) or {}
    profesor_id = data.get('profesor_id')

    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'SELECT filepath FROM prof_videos WHERE id = %s AND profesor_id = %s',
                (video_id, profesor_id)
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return jsonify({'success': False, 'message': 'Video no encontrado'}), 404

            cur.execute(
                'DELETE FROM prof_videos WHERE id = %s AND profesor_id = %s',
                (video_id, profesor_id)
            )
            conn.commit()
        conn.close()

        # Borrar archivo físico
        if row[0] and os.path.exists(row[0]):
            os.remove(row[0])

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# Servir archivos de video almacenados
@app.route('/uploads/videos/<int:profesor_id>/<path:filename>')
def serve_video(profesor_id, filename):
    folder = os.path.join(UPLOAD_FOLDER, 'videos', str(profesor_id))
    return send_from_directory(folder, filename)


# ════════════════════════════════════════════════
#  IMÁGENES
# ════════════════════════════════════════════════

@app.route('/api/profesor/imagenes', methods=['GET'])
def get_profesor_imagenes():
    profesor_id = request.args.get('profesor_id', type=int)
    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, titulo, tipo, descripcion, hashtags, filename, creado_en
                FROM prof_imagenes
                WHERE profesor_id = %s
                ORDER BY creado_en DESC
                """,
                (profesor_id,)
            )
            rows = cur.fetchall()
        conn.close()

        imagenes = [
            {
                'id':          r[0],
                'titulo':      r[1],
                'tipo':        r[2],
                'descripcion': r[3],
                'hashtags':    r[4] or [],
                'filename':    r[5],
                'creado_en':   r[6].isoformat() if r[6] else None,
                'url':         f'/uploads/imagenes/{profesor_id}/{r[5]}',
            }
            for r in rows
        ]
        return jsonify({'success': True, 'imagenes': imagenes})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/imagenes', methods=['POST'])
def upload_imagen():
    """
    Recibe una imagen vía multipart/form-data.
    Campos: profesor_id, titulo, tipo, descripcion, hashtags
    Archivo: imagen (campo 'file')
    """
    profesor_id = request.form.get('profesor_id', type=int)
    titulo      = (request.form.get('titulo') or '').strip()
    tipo        = (request.form.get('tipo') or 'diagrama').strip()
    descripcion = (request.form.get('descripcion') or '').strip()
    raw_tags    = request.form.get('hashtags', '')
    hashtags    = [t.lower() for t in re.findall(r'#([A-Za-z0-9_]+)', raw_tags)]

    if not profesor_id or not titulo:
        return jsonify({'success': False, 'message': 'Faltan campos obligatorios'}), 400

    if not _get_profesor(profesor_id):
        return jsonify({'success': False, 'message': 'Usuario no es profesor'}), 403

    file = request.files.get('file')
    if not file or file.filename == '':
        return jsonify({'success': False, 'message': 'No se recibió ningún archivo'}), 400

    if not _allowed_file(file.filename, ALLOWED_IMAGE):
        return jsonify({'success': False, 'message': 'Formato de imagen no permitido'}), 400

    file.stream.seek(0, 2)
    size_mb = file.stream.tell() / (1024 * 1024)
    file.stream.seek(0)
    if size_mb > MAX_IMAGE_MB:
        return jsonify({'success': False, 'message': f'La imagen supera los {MAX_IMAGE_MB} MB'}), 413

    ext       = file.filename.rsplit('.', 1)[-1].lower()
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    subfolder = os.path.join(UPLOAD_FOLDER, 'imagenes', str(profesor_id))
    os.makedirs(subfolder, exist_ok=True)
    filepath  = os.path.join(subfolder, safe_name)
    file.save(filepath)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prof_imagenes
                    (profesor_id, titulo, tipo, descripcion, hashtags, filename, filepath)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                RETURNING id, creado_en
                """,
                (profesor_id, titulo, tipo, descripcion,
                 hashtags, safe_name, filepath)
            )
            row = cur.fetchone()
            conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'imagen': {
                'id':        row[0],
                'titulo':    titulo,
                'tipo':      tipo,
                'url':       f'/uploads/imagenes/{profesor_id}/{safe_name}',
                'creado_en': row[1].isoformat(),
            }
        }), 201

    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/imagenes/<int:imagen_id>', methods=['DELETE'])
def delete_imagen(imagen_id):
    data        = request.get_json(silent=True) or {}
    profesor_id = data.get('profesor_id')

    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'SELECT filepath FROM prof_imagenes WHERE id = %s AND profesor_id = %s',
                (imagen_id, profesor_id)
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return jsonify({'success': False, 'message': 'Imagen no encontrada'}), 404

            cur.execute(
                'DELETE FROM prof_imagenes WHERE id = %s AND profesor_id = %s',
                (imagen_id, profesor_id)
            )
            conn.commit()
        conn.close()

        if row[0] and os.path.exists(row[0]):
            os.remove(row[0])

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/uploads/imagenes/<int:profesor_id>/<path:filename>')
def serve_imagen(profesor_id, filename):
    folder = os.path.join(UPLOAD_FOLDER, 'imagenes', str(profesor_id))
    return send_from_directory(folder, filename)


# ════════════════════════════════════════════════
#  INSTRUCCIONALES
# ════════════════════════════════════════════════

@app.route('/api/profesor/instruccionales', methods=['GET'])
def get_instruccionales():
    profesor_id = request.args.get('profesor_id', type=int)
    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, titulo, descripcion, nivel, categoria, videos_ids, creado_en
                FROM prof_instruccionales
                WHERE profesor_id = %s
                ORDER BY creado_en DESC
                """,
                (profesor_id,)
            )
            rows = cur.fetchall()
        conn.close()

        items = [
            {
                'id':          r[0],
                'titulo':      r[1],
                'descripcion': r[2],
                'nivel':       r[3],
                'categoria':   r[4],
                'videos_ids':  r[5] or [],
                'creado_en':   r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ]
        return jsonify({'success': True, 'instruccionales': items})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/instruccionales', methods=['POST'])
def create_instruccional():
    data        = request.get_json(silent=True)
    if not data:
        return jsonify({'success': False, 'message': 'JSON inválido'}), 400

    profesor_id = data.get('profesor_id')
    titulo      = (data.get('titulo') or '').strip()
    descripcion = (data.get('descripcion') or '').strip()
    nivel       = (data.get('nivel') or 'principiante').strip()
    categoria   = (data.get('categoria') or '').strip()
    videos_ids  = [int(v) for v in (data.get('videos_ids') or []) if str(v).isdigit()]

    if not profesor_id or not titulo:
        return jsonify({'success': False, 'message': 'Faltan campos obligatorios'}), 400

    if not _get_profesor(profesor_id):
        return jsonify({'success': False, 'message': 'Usuario no es profesor'}), 403

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prof_instruccionales
                    (profesor_id, titulo, descripcion, nivel, categoria, videos_ids)
                VALUES (%s,%s,%s,%s,%s,%s)
                RETURNING id, creado_en
                """,
                (profesor_id, titulo, descripcion, nivel, categoria, videos_ids)
            )
            row = cur.fetchone()
            conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'instruccional': {
                'id':        row[0],
                'titulo':    titulo,
                'nivel':     nivel,
                'creado_en': row[1].isoformat(),
            }
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/instruccionales/<int:inst_id>', methods=['DELETE'])
def delete_instruccional(inst_id):
    data        = request.get_json(silent=True) or {}
    profesor_id = data.get('profesor_id')

    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM prof_instruccionales WHERE id = %s AND profesor_id = %s RETURNING id',
                (inst_id, profesor_id)
            )
            deleted = cur.fetchone()
            conn.commit()
        conn.close()

        if not deleted:
            return jsonify({'success': False, 'message': 'Instruccional no encontrado'}), 404

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ════════════════════════════════════════════════
#  DIAGRAMAS
# ════════════════════════════════════════════════

@app.route('/api/profesor/diagramas', methods=['GET'])
def get_diagramas():
    profesor_id = request.args.get('profesor_id', type=int)
    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, titulo, descripcion, nodos, tipo, creado_en
                FROM prof_diagramas
                WHERE profesor_id = %s
                ORDER BY creado_en DESC
                """,
                (profesor_id,)
            )
            rows = cur.fetchall()
        conn.close()

        items = [
            {
                'id':          r[0],
                'titulo':      r[1],
                'descripcion': r[2],
                'nodos':       r[3],
                'tipo':        r[4],
                'creado_en':   r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]
        return jsonify({'success': True, 'diagramas': items})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/diagramas', methods=['POST'])
def create_diagrama():
    data        = request.get_json(silent=True)
    if not data:
        return jsonify({'success': False, 'message': 'JSON inválido'}), 400

    profesor_id = data.get('profesor_id')
    titulo      = (data.get('titulo') or '').strip()
    descripcion = (data.get('descripcion') or '').strip()
    nodos       = (data.get('nodos') or '').strip()
    tipo        = (data.get('tipo') or 'arbol_decision').strip()

    if not profesor_id or not titulo or not nodos:
        return jsonify({'success': False, 'message': 'Faltan campos obligatorios'}), 400

    if not _get_profesor(profesor_id):
        return jsonify({'success': False, 'message': 'Usuario no es profesor'}), 403

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prof_diagramas
                    (profesor_id, titulo, descripcion, nodos, tipo)
                VALUES (%s,%s,%s,%s,%s)
                RETURNING id, creado_en
                """,
                (profesor_id, titulo, descripcion, nodos, tipo)
            )
            row = cur.fetchone()
            conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'diagrama': {
                'id':        row[0],
                'titulo':    titulo,
                'tipo':      tipo,
                'creado_en': row[1].isoformat(),
            }
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/profesor/diagramas/<int:diag_id>', methods=['DELETE'])
def delete_diagrama(diag_id):
    data        = request.get_json(silent=True) or {}
    profesor_id = data.get('profesor_id')

    if not profesor_id:
        return jsonify({'success': False, 'message': 'Falta profesor_id'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM prof_diagramas WHERE id = %s AND profesor_id = %s RETURNING id',
                (diag_id, profesor_id)
            )
            deleted = cur.fetchone()
            conn.commit()
        conn.close()

        if not deleted:
            return jsonify({'success': False, 'message': 'Diagrama no encontrado'}), 404

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/')
def root():
    return send_from_directory('.', 'login.html')


@app.route('/health')
def health():
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT NOW()')
            now = cur.fetchone()[0]
        conn.close()
        return jsonify({"ok": True, "time": str(now)})
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route('/api/forum/posts', methods=['GET'])
def get_forum_posts():
    hashtag_filter = (request.args.get('hashtag') or '').strip().lower()
    user_id = request.args.get('user_id', type=int)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            query = """
                SELECT fp.id, fp.usuario_id, u.nombre AS autor_nombre,
                       fp.mensaje, fp.hashtags, fp.imagen_url, fp.creado_en
                FROM foro_publicaciones fp
                JOIN usuarios u ON u.id = fp.usuario_id
            """
            params = []

            if hashtag_filter:
                query += " WHERE %s = ANY(fp.hashtags)"
                params.append(hashtag_filter)

            query += " ORDER BY fp.creado_en DESC LIMIT 100"
            cur.execute(query, params)
            rows = cur.fetchall()

            posts = []
            for row in rows:
                post_id = row[0]
                cur.execute('SELECT COUNT(*) FROM foro_likes WHERE post_id = %s', (post_id,))
                likes_count = cur.fetchone()[0]
                cur.execute('SELECT COUNT(*) FROM foro_respuestas WHERE post_id = %s', (post_id,))
                replies_count = cur.fetchone()[0]

                liked = False
                if user_id is not None:
                    cur.execute('SELECT 1 FROM foro_likes WHERE post_id = %s AND usuario_id = %s', (post_id, user_id))
                    liked = cur.fetchone() is not None

                cur.execute(
                    """
                    SELECT fr.id, fr.usuario_id, u.nombre AS autor_nombre, fr.mensaje, fr.creado_en
                    FROM foro_respuestas fr
                    JOIN usuarios u ON u.id = fr.usuario_id
                    WHERE fr.post_id = %s
                    ORDER BY fr.creado_en ASC
                    """,
                    (post_id,),
                )
                replies_rows = cur.fetchall()

                replies = [
                    {
                        "id": reply_row[0],
                        "user_id": reply_row[1],
                        "author_name": reply_row[2],
                        "message": reply_row[3],
                        "created_at": reply_row[4].isoformat() if reply_row[4] else None,
                    }
                    for reply_row in replies_rows
                ]

                posts.append({
                    "id": row[0],
                    "user_id": row[1],
                    "author_name": row[2],
                    "message": row[3],
                    "hashtags": row[4] or [],
                    "image_url": row[5],
                    "created_at": row[6].isoformat() if row[6] else None,
                    "likes_count": likes_count,
                    "liked": liked,
                    "replies": replies,
                    "replies_count": replies_count,
                })

        conn.close()
        return jsonify({"posts": posts})
    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/forum/posts', methods=['POST'])
def create_forum_post():
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        user_id = request.form.get('user_id', type=int)
        message = (request.form.get('message') or '').strip()
    else:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"success": False, "message": "JSON inválido"}), 400
        user_id = data.get('user_id')
        message = (data.get('message') or '').strip()

    if user_id is None:
        return jsonify({"success": False, "message": "Falta el usuario"}), 400
    if not message:
        return jsonify({"success": False, "message": "La publicación no puede estar vacía"}), 400

    image_url = None
    image_file = request.files.get('image')
    if image_file and image_file.filename:
        if not _allowed_file(image_file.filename, ALLOWED_IMAGE):
            return jsonify({"success": False, "message": "Formato de imagen no permitido"}), 400
        safe_name = f"{uuid.uuid4().hex}.{image_file.filename.rsplit('.', 1)[-1].lower()}"
        subfolder = os.path.join(UPLOAD_FOLDER, 'forum')
        os.makedirs(subfolder, exist_ok=True)
        filepath = os.path.join(subfolder, safe_name)
        image_file.save(filepath)
        image_url = f"/uploads/forum/{safe_name}"

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT id, nombre FROM usuarios WHERE id = %s', (user_id,))
            user = cur.fetchone()

            if not user:
                conn.close()
                return jsonify({"success": False, "message": "Usuario no encontrado"}), 404

            hashtags = [tag.lower() for tag in re.findall(r'#([A-Za-z0-9_]+)', message)]
            cur.execute(
                """
                INSERT INTO foro_publicaciones (usuario_id, mensaje, hashtags, imagen_url)
                VALUES (%s, %s, %s, %s)
                RETURNING id, usuario_id, mensaje, hashtags, imagen_url, creado_en
                """,
                (user_id, message, hashtags, image_url),
            )
            row = cur.fetchone()
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "post": {
                "id": row[0],
                "user_id": row[1],
                "message": row[2],
                "hashtags": row[3] or [],
                "image_url": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "author_name": user[1],
                "likes_count": 0,
                "liked": False,
                "replies": [],
                "replies_count": 0,
            }
        })
    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/forum/posts/<int:post_id>/like', methods=['POST'])
def toggle_like(post_id):
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "message": "JSON inválido"}), 400

    user_id = data.get('user_id')
    if user_id is None:
        return jsonify({"success": False, "message": "Falta el usuario"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM foro_publicaciones WHERE id = %s', (post_id,))
            post = cur.fetchone()

            if not post:
                conn.close()
                return jsonify({"success": False, "message": "Publicación no encontrada"}), 404

            cur.execute('SELECT 1 FROM foro_likes WHERE post_id = %s AND usuario_id = %s', (post_id, user_id))
            existing = cur.fetchone()

            if existing:
                cur.execute('DELETE FROM foro_likes WHERE post_id = %s AND usuario_id = %s', (post_id, user_id))
                liked = False
            else:
                cur.execute('INSERT INTO foro_likes (post_id, usuario_id) VALUES (%s, %s)', (post_id, user_id))
                liked = True

            cur.execute('SELECT COUNT(*) FROM foro_likes WHERE post_id = %s', (post_id,))
            likes_count = cur.fetchone()[0]

        conn.commit()
        conn.close()

        return jsonify({"success": True, "liked": liked, "likes_count": likes_count})
    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/forum/posts/<int:post_id>/replies', methods=['POST'])
def create_reply(post_id):
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "message": "JSON inválido"}), 400

    user_id = data.get('user_id')
    message = (data.get('message') or '').strip()

    if user_id is None:
        return jsonify({"success": False, "message": "Falta el usuario"}), 400

    if not message:
        return jsonify({"success": False, "message": "La respuesta no puede estar vacía"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT usuario_id FROM foro_publicaciones WHERE id = %s', (post_id,))
            post = cur.fetchone()

            if not post:
                conn.close()
                return jsonify({"success": False, "message": "Publicación no encontrada"}), 404

            post_owner_id = post[0]
            cur.execute('SELECT id, nombre FROM usuarios WHERE id = %s', (user_id,))
            user = cur.fetchone()

            if not user:
                conn.close()
                return jsonify({"success": False, "message": "Usuario no encontrado"}), 404

            cur.execute(
                """
                INSERT INTO foro_respuestas (post_id, usuario_id, mensaje)
                VALUES (%s, %s, %s)
                RETURNING id, post_id, usuario_id, mensaje, creado_en
                """,
                (post_id, user_id, message),
            )
            row = cur.fetchone()

            if post_owner_id != user_id:
                cur.execute(
                    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, prioridad, metadata, leida)"
                    " VALUES (%s, %s, %s, %s, %s, %s::jsonb, FALSE)",
                    (
                        post_owner_id,
                        'Respuesta en tu foro',
                        f'@{user[1]} respondió tu publicación en el foro.',
                        'forum',
                        'normal',
                        json.dumps({'post_id': post_id, 'reply_id': row[0]}),
                    ),
                )

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "reply": {
                "id": row[0],
                "post_id": row[1],
                "user_id": row[2],
                "author_name": user[1],
                "message": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
            }
        })
    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    user_id = request.args.get('user_id', type=int)

    if user_id is None:
        return jsonify({"success": False, "message": "Falta el usuario"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM notificaciones WHERE usuario_id = %s', (user_id,))
            notification_count = cur.fetchone()[0]

            if notification_count == 0:
                sample_notifications = [
                    (
                        user_id,
                        'Nuevo comentario',
                        'Tu publicación recibió una respuesta nueva en el foro.',
                        'forum',
                        'normal',
                        {'pill': 'Comunidad'},
                        False,
                    ),
                    (
                        user_id,
                        'Sugerencia de entrenamiento',
                        'Revisa tus ejercicios de movilidad para esta semana.',
                        'training',
                        'normal',
                        {'pill': 'Entrenamiento'},
                        False,
                    ),
                ]
                for notification in sample_notifications:
                    serialized_notification = (
                        notification[0],
                        notification[1],
                        notification[2],
                        notification[3],
                        notification[4],
                        json.dumps(notification[5]),
                        notification[6],
                    )
                    cur.execute(
                        """
                        INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, prioridad, metadata, leida)
                        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
                        """,
                        serialized_notification,
                    )
                conn.commit()

            cur.execute(
                """
                SELECT id, titulo, mensaje, tipo, prioridad, metadata, leida, creado_en
                FROM notificaciones
                WHERE usuario_id = %s
                ORDER BY creado_en DESC
                LIMIT 40
                """,
                (user_id,),
            )
            rows = cur.fetchall()

        conn.close()

        notifications = []
        for row in rows:
            notifications.append({
                "id": row[0],
                "title": row[1],
                "message": row[2],
                "type": row[3],
                "priority": row[4],
                "metadata": row[5] or {},
                "read": row[6],
                "created_at": row[7].isoformat() if row[7] else None,
            })

        return jsonify({"notifications": notifications})
    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')

    if user_id is None:
        return jsonify({"success": False, "message": "Falta el usuario"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE notificaciones SET leida = TRUE WHERE id = %s AND usuario_id = %s RETURNING id",
                (notification_id, user_id),
            )
            updated = cur.fetchone()
        conn.commit()
        conn.close()

        if not updated:
            return jsonify({"success": False, "message": "Notificación no encontrada"}), 404

        return jsonify({"success": True})
    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/notifications/read-all', methods=['POST'])
def mark_all_notifications_read():
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')

    if user_id is None:
        return jsonify({"success": False, "message": "Falta el usuario"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE notificaciones SET leida = TRUE WHERE usuario_id = %s",
                (user_id,),
            )
        conn.commit()
        conn.close()

        return jsonify({"success": True})
    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True)
    print('REGISTER PAYLOAD:', data)
    try:
        with open('register_payload.log', 'a', encoding='utf-8') as f:
            f.write(repr(data) + "\n")
    except Exception:
        pass

    if not data:
        return jsonify({"success": False, "message": "JSON inválido"}), 400

    nombre = (data.get('nombre') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    rol = (data.get('rol') or '').strip()
    rango = (data.get('rango') or '').strip() or None
    metodo_pago = (data.get('metodo_pago') or 'tarjeta').strip()

    if not nombre or not email or not password or not rol:
        return jsonify({"success": False, "message": "Faltan campos obligatorios"}), 400

    allowed_roles = {'alumno', 'profesor'}
    allowed_payments = {'tarjeta', 'paypal', 'transferencia'}

    if rol not in allowed_roles:
        return jsonify({"success": False, "message": "Rol inválido"}), 400

    if metodo_pago not in allowed_payments:
        return jsonify({"success": False, "message": "Método de pago inválido"}), 400

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    # Guardar estado por defecto 'activo' para evitar violaciones NOT NULL
    estado = 'activo'
    rango_final = rango if rol == 'alumno' else None

    try:
        # marker: start db insert
        try:
            with open('register_steps.log','a',encoding='utf-8') as f:
                f.write('start_insert\n')
        except Exception:
            pass

        conn = get_connection()
        with conn.cursor() as cur:
            try:
                with open('register_steps.log','a',encoding='utf-8') as f:
                    f.write('about_to_execute\n')
            except Exception:
                pass

            cur.execute(
                """
                INSERT INTO usuarios (nombre, email, password_hash, rol, rango, metodo_pago, estado)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, nombre, email, rol, rango, metodo_pago, estado, creado_en
                """,
                (nombre, email, password_hash, rol, rango_final, metodo_pago, estado),
            )
            row = cur.fetchone()

        try:
            with open('register_steps.log','a',encoding='utf-8') as f:
                f.write('fetched_row\n')
        except Exception:
            pass

        conn.commit()
        conn.close()

        try:
            with open('register_steps.log','a',encoding='utf-8') as f:
                f.write('committed\n')
        except Exception:
            pass

        return jsonify({"success": True, "user": {
            "id": row[0],
            "nombre": row[1],
            "email": row[2],
            "rol": row[3],
            "rango": row[4],
            "metodo_pago": row[5],
            "estado": row[6],
            "creado_en": row[7].isoformat(),
        }})
    except errors.UniqueViolation:
        return jsonify({"success": False, "message": "Ese correo ya está registrado"}), 409
    except Exception as error:
        # Imprimir traza en la salida para diagnóstico en desarrollo y escribirla en archivo
        tb = traceback.format_exc()
        print(tb)
        try:
            with open('register_error.log', 'a', encoding='utf-8') as f:
                f.write(tb + "\n")
        except Exception:
            pass
        return jsonify({"success": False, "message": str(error)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "message": "JSON inválido"}), 400

    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not email or not password:
        return jsonify({"success": False, "message": "Correo y contraseña son obligatorios"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, nombre, email, password_hash, rol, rango, metodo_pago, estado, creado_en
                FROM usuarios
                WHERE email = %s
                """,
                (email,),
            )
            row = cur.fetchone()

            if not row:
                nombre = email.split('@')[0].replace('.', ' ').replace('_', ' ').strip().title() or 'Usuario'
                password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                cur.execute(
                    """
                    INSERT INTO usuarios (nombre, email, password_hash, rol, rango, metodo_pago, estado)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, nombre, email, password_hash, rol, rango, metodo_pago, estado, creado_en
                    """,
                    (nombre, email, password_hash, 'alumno', None, 'tarjeta', 'activo'),
                )
                row = cur.fetchone()
                conn.commit()
            else:
                stored_hash = row[3]
                is_valid = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))

                if not is_valid:
                    conn.close()
                    return jsonify({"success": False, "message": "Credenciales inválidas"}), 401

        conn.close()

        return jsonify({"success": True, "user": {
            "id": row[0],
            "nombre": row[1],
            "email": row[2],
            "rol": row[4],
            "rango": row[5],
            "metodo_pago": row[6],
            "estado": row[7],
            "creado_en": row[8].isoformat(),
        }})
    except Exception as error:
        return jsonify({"success": False, "message": "Error interno del servidor"}), 500
def _get_mod(mod_id):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM usuarios WHERE id = %s AND rol = 'moderador'",
                (mod_id,)
            )
            return cur.fetchone()
    finally:
        conn.close()


# ════════════════════════════════════════════════
#  USUARIOS — CRUD completo para moderador
# ════════════════════════════════════════════════

@app.route('/api/mod/usuarios', methods=['GET'])
def mod_get_usuarios():
    """Lista todos los usuarios de la plataforma."""
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, nombre, email, rol, rango, metodo_pago, estado, creado_en
                FROM usuarios
                ORDER BY creado_en DESC
                """
            )
            rows = cur.fetchall()
        conn.close()

        usuarios = [
            {
                'id':          r[0],
                'nombre':      r[1],
                'email':       r[2],
                'rol':         r[3],
                'rango':       r[4],
                'metodo_pago': r[5],
                'estado':      r[6],
                'creado_en':   r[7].isoformat() if r[7] else None,
            }
            for r in rows
        ]
        return jsonify({'success': True, 'usuarios': usuarios})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/usuarios/<int:user_id>', methods=['PUT'])
def mod_update_usuario(user_id):
    """Actualiza nombre, email, rol, estado y/o rango de un usuario."""
    data   = request.get_json(silent=True) or {}
    mod_id = data.get('mod_id')

    if not mod_id or not _get_mod(mod_id):
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    nombre = (data.get('nombre') or '').strip()
    email  = (data.get('email')  or '').strip()
    rol    = (data.get('rol')    or '').strip()
    estado = (data.get('estado') or '').strip()
    rango  = data.get('rango')

    allowed_roles   = {'alumno', 'profesor', 'moderador'}
    allowed_estados = {'activo', 'pendiente', 'suspendido'}

    if rol    and rol    not in allowed_roles:
        return jsonify({'success': False, 'message': 'Rol inválido'}), 400
    if estado and estado not in allowed_estados:
        return jsonify({'success': False, 'message': 'Estado inválido'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # Construir SET dinámico solo con campos enviados
            fields, values = [], []
            if nombre: fields.append('nombre = %s');      values.append(nombre)
            if email:  fields.append('email = %s');       values.append(email)
            if rol:    fields.append('rol = %s');         values.append(rol)
            if estado: fields.append('estado = %s');      values.append(estado)
            fields.append('rango = %s');                  values.append(rango)

            if not fields:
                conn.close()
                return jsonify({'success': False, 'message': 'Nada que actualizar'}), 400

            values.append(user_id)
            cur.execute(
                f"UPDATE usuarios SET {', '.join(fields)} WHERE id = %s RETURNING id",
                values
            )
            updated = cur.fetchone()
            conn.commit()
        conn.close()

        if not updated:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/usuarios/<int:user_id>', methods=['DELETE'])
def mod_delete_usuario(user_id):
    """Elimina un usuario (en cascada también su contenido)."""
    data   = request.get_json(silent=True) or {}
    mod_id = data.get('mod_id')

    if not mod_id or not _get_mod(mod_id):
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    # No permitir autoeliminarse
    if user_id == int(mod_id):
        return jsonify({'success': False, 'message': 'No puedes eliminarte a ti mismo'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('DELETE FROM usuarios WHERE id = %s RETURNING id', (user_id,))
            deleted = cur.fetchone()
            conn.commit()
        conn.close()

        if not deleted:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ════════════════════════════════════════════════
#  CONTENIDO — lectura y borrado para moderador
# ════════════════════════════════════════════════

@app.route('/api/mod/videos', methods=['GET'])
def mod_get_videos():
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.id, v.profesor_id, u.nombre AS profesor_nombre,
                       v.titulo, v.categoria, v.dificultad,
                       v.hashtags, v.filename, v.creado_en
                FROM prof_videos v
                JOIN usuarios u ON u.id = v.profesor_id
                ORDER BY v.creado_en DESC
                """
            )
            rows = cur.fetchall()
        conn.close()
        return jsonify({'success': True, 'videos': [
            {
                'id': r[0], 'profesor_id': r[1], 'profesor_nombre': r[2],
                'titulo': r[3], 'categoria': r[4], 'dificultad': r[5],
                'hashtags': r[6] or [], 'filename': r[7],
                'creado_en': r[8].isoformat() if r[8] else None,
            } for r in rows
        ]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/videos/<int:video_id>', methods=['GET'])
def get_video_detail(video_id):
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.id, v.profesor_id, u.nombre AS profesor_nombre,
                       v.titulo, v.categoria, v.dificultad, v.descripcion,
                       v.hashtags, v.filename, v.creado_en
                FROM prof_videos v
                JOIN usuarios u ON u.id = v.profesor_id
                WHERE v.id = %s
                """,
                (video_id,)
            )
            row = cur.fetchone()
        conn.close()

        if not row:
            return jsonify({'success': False, 'message': 'Video no encontrado'}), 404

        return jsonify({'success': True, 'video': {
            'id': row[0],
            'profesor_id': row[1],
            'profesor_nombre': row[2],
            'titulo': row[3],
            'categoria': row[4],
            'dificultad': row[5],
            'descripcion': row[6],
            'hashtags': row[7] or [],
            'video_url': f'/uploads/videos/{row[1]}/{row[8]}',
            'filename': row[8],
            'created_at': row[9].isoformat() if row[9] else None,
        }})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/videos/<int:video_id>/comments', methods=['GET', 'POST'])
def video_comments(video_id):
    if request.method == 'GET':
        try:
            conn = get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT vc.id, vc.usuario_id, u.nombre AS autor_nombre,
                           vc.mensaje, vc.creado_en
                    FROM video_comentarios vc
                    JOIN usuarios u ON u.id = vc.usuario_id
                    WHERE vc.video_id = %s
                    ORDER BY vc.creado_en ASC
                    """,
                    (video_id,)
                )
                rows = cur.fetchall()
            conn.close()
            return jsonify({'success': True, 'comments': [
                {
                    'id': r[0], 'user_id': r[1], 'author_name': r[2],
                    'message': r[3], 'created_at': r[4].isoformat() if r[4] else None,
                } for r in rows
            ]})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'success': False, 'message': 'JSON inválido'}), 400

    user_id = data.get('user_id')
    message = (data.get('message') or '').strip()
    if user_id is None:
        return jsonify({'success': False, 'message': 'Falta el usuario'}), 400
    if not message:
        return jsonify({'success': False, 'message': 'El comentario no puede estar vacío'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM prof_videos WHERE id = %s', (video_id,))
            if not cur.fetchone():
                conn.close()
                return jsonify({'success': False, 'message': 'Video no encontrado'}), 404

            cur.execute('SELECT id, nombre FROM usuarios WHERE id = %s', (user_id,))
            user = cur.fetchone()
            if not user:
                conn.close()
                return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

            cur.execute('SELECT profesor_id FROM prof_videos WHERE id = %s', (video_id,))
            owner = cur.fetchone()
            owner_id = owner[0] if owner else None

            cur.execute(
                """
                INSERT INTO video_comentarios (video_id, usuario_id, mensaje)
                VALUES (%s, %s, %s)
                RETURNING id, creado_en
                """,
                (video_id, user_id, message)
            )
            comment = cur.fetchone()

            if owner_id and owner_id != user_id:
                cur.execute(
                    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, prioridad, metadata, leida) "
                    "VALUES (%s, %s, %s, %s, %s, %s::jsonb, FALSE)",
                    (
                        owner_id,
                        'Nuevo comentario',
                        f'@{user[1]} comentó tu video.',
                        'video',
                        'normal',
                        json.dumps({'video_id': video_id, 'comment_id': comment[0]}),
                    )
                )

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'comment': {
            'id': comment[0], 'user_id': user_id, 'author_name': user[1],
            'message': message, 'created_at': comment[1].isoformat() if comment[1] else None,
        }})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    viewer_id = request.args.get('viewer_id', type=int)
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, nombre, email, rol, rango, estado, creado_en
                FROM usuarios
                WHERE id = %s
                """,
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

            cur.execute('SELECT COUNT(*) FROM seguimientos WHERE seguido_id = %s', (user_id,))
            followers = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM seguimientos WHERE seguidor_id = %s', (user_id,))
            following = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM prof_videos WHERE profesor_id = %s', (user_id,))
            videos = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM prof_imagenes WHERE profesor_id = %s', (user_id,))
            imagenes = cur.fetchone()[0]

            is_following = False
            if viewer_id is not None:
                cur.execute(
                    'SELECT 1 FROM seguimientos WHERE seguidor_id = %s AND seguido_id = %s',
                    (viewer_id, user_id)
                )
                is_following = cur.fetchone() is not None
        conn.close()

        return jsonify({'success': True, 'profile': {
            'id': row[0], 'nombre': row[1], 'email': row[2], 'rol': row[3],
            'rango': row[4], 'estado': row[5], 'created_at': row[6].isoformat() if row[6] else None,
            'followers_count': followers, 'following_count': following,
            'video_count': videos, 'imagen_count': imagenes,
            'is_following': is_following,
        }})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/users/<int:target_id>/follow', methods=['POST', 'DELETE'])
def follow_user(target_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    if user_id is None:
        return jsonify({'success': False, 'message': 'Falta el usuario'}), 400
    if user_id == target_id:
        return jsonify({'success': False, 'message': 'No puedes seguirte a ti mismo'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM usuarios WHERE id = %s', (user_id,))
            if not cur.fetchone():
                conn.close()
                return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404
            cur.execute('SELECT id FROM usuarios WHERE id = %s', (target_id,))
            if not cur.fetchone():
                conn.close()
                return jsonify({'success': False, 'message': 'Usuario objetivo no encontrado'}), 404

            if request.method == 'POST':
                cur.execute(
                    'INSERT INTO seguimientos (seguidor_id, seguido_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                    (user_id, target_id)
                )
                cur.execute(
                    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, prioridad, metadata, leida) "
                    "VALUES (%s, %s, %s, %s, %s, %s::jsonb, FALSE)",
                    (
                        target_id,
                        'Nuevo seguidor',
                        f'@{user_id} ahora te sigue.',
                        'social',
                        'normal',
                        json.dumps({'follower_id': user_id}),
                    )
                )
                conn.commit()
                conn.close()
                return jsonify({'success': True, 'following': True})

            cur.execute('DELETE FROM seguimientos WHERE seguidor_id = %s AND seguido_id = %s', (user_id, target_id))
            conn.commit()
        conn.close()
        return jsonify({'success': True, 'following': False})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/videos/<int:video_id>', methods=['DELETE'])
def mod_delete_video(video_id):
    data   = request.get_json(silent=True) or {}
    mod_id = data.get('mod_id')
    if not mod_id or not _get_mod(mod_id):
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'SELECT filepath FROM prof_videos WHERE id = %s', (video_id,)
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return jsonify({'success': False, 'message': 'Video no encontrado'}), 404
            cur.execute('DELETE FROM prof_videos WHERE id = %s', (video_id,))
            conn.commit()
        conn.close()
        if row[0] and os.path.exists(row[0]):
            os.remove(row[0])
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/imagenes', methods=['GET'])
def mod_get_imagenes():
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT i.id, i.profesor_id, u.nombre AS profesor_nombre,
                       i.titulo, i.tipo, i.hashtags, i.filename, i.creado_en
                FROM prof_imagenes i
                JOIN usuarios u ON u.id = i.profesor_id
                ORDER BY i.creado_en DESC
                """
            )
            rows = cur.fetchall()
        conn.close()
        return jsonify({'success': True, 'imagenes': [
            {
                'id': r[0], 'profesor_id': r[1], 'profesor_nombre': r[2],
                'titulo': r[3], 'tipo': r[4], 'hashtags': r[5] or [],
                'filename': r[6],
                'creado_en': r[7].isoformat() if r[7] else None,
            } for r in rows
        ]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/imagenes/<int:imagen_id>', methods=['DELETE'])
def mod_delete_imagen(imagen_id):
    data   = request.get_json(silent=True) or {}
    mod_id = data.get('mod_id')
    if not mod_id or not _get_mod(mod_id):
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'SELECT filepath FROM prof_imagenes WHERE id = %s', (imagen_id,)
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return jsonify({'success': False, 'message': 'Imagen no encontrada'}), 404
            cur.execute('DELETE FROM prof_imagenes WHERE id = %s', (imagen_id,))
            conn.commit()
        conn.close()
        if row[0] and os.path.exists(row[0]):
            os.remove(row[0])
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/instruccionales', methods=['GET'])
def mod_get_instruccionales():
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, profesor_id, titulo, nivel, categoria, videos_ids, creado_en
                FROM prof_instruccionales ORDER BY creado_en DESC
                """
            )
            rows = cur.fetchall()
        conn.close()
        return jsonify({'success': True, 'instruccionales': [
            {
                'id': r[0], 'profesor_id': r[1], 'titulo': r[2],
                'nivel': r[3], 'categoria': r[4],
                'videos_ids': r[5] or [],
                'creado_en': r[6].isoformat() if r[6] else None,
            } for r in rows
        ]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/instruccionales/<int:inst_id>', methods=['DELETE'])
def mod_delete_instruccional(inst_id):
    data   = request.get_json(silent=True) or {}
    mod_id = data.get('mod_id')
    if not mod_id or not _get_mod(mod_id):
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM prof_instruccionales WHERE id = %s RETURNING id', (inst_id,)
            )
            deleted = cur.fetchone()
            conn.commit()
        conn.close()
        if not deleted:
            return jsonify({'success': False, 'message': 'No encontrado'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/foro/<int:post_id>', methods=['DELETE'])
def mod_delete_post(post_id):
    data   = request.get_json(silent=True) or {}
    mod_id = data.get('mod_id')
    if not mod_id or not _get_mod(mod_id):
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # Borrar likes y respuestas primero
            cur.execute('DELETE FROM foro_likes     WHERE post_id = %s', (post_id,))
            cur.execute('DELETE FROM foro_respuestas WHERE post_id = %s', (post_id,))
            cur.execute(
                'DELETE FROM foro_publicaciones WHERE id = %s RETURNING id', (post_id,)
            )
            deleted = cur.fetchone()
            conn.commit()
        conn.close()
        if not deleted:
            return jsonify({'success': False, 'message': 'Post no encontrado'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ════════════════════════════════════════════════
#  PERFIL PROPIO — edición para cualquier rol
# ════════════════════════════════════════════════

@app.route('/api/mod/perfil', methods=['PUT'])
def mod_update_perfil():
    """
    Permite a cualquier usuario editar su propio perfil.
    Requiere contraseña actual para confirmar identidad.
    """
    data             = request.get_json(silent=True) or {}
    user_id          = data.get('user_id')
    nombre           = (data.get('nombre')          or '').strip()
    email            = (data.get('email')           or '').strip()
    password_actual  = data.get('password_actual',  '')
    password_nueva   = data.get('password_nueva',   None)

    if not user_id or not nombre or not email or not password_actual:
        return jsonify({'success': False, 'message': 'Faltan campos obligatorios'}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                'SELECT password_hash FROM usuarios WHERE id = %s', (user_id,)
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

            # Verificar contraseña actual
            if not bcrypt.checkpw(password_actual.encode(), row[0].encode()):
                conn.close()
                return jsonify({'success': False, 'message': 'Contraseña actual incorrecta'}), 401

            # Actualizar
            if password_nueva:
                new_hash = bcrypt.hashpw(password_nueva.encode(), bcrypt.gensalt()).decode()
                cur.execute(
                    """
                    UPDATE usuarios SET nombre=%s, email=%s, password_hash=%s
                    WHERE id=%s
                    RETURNING id, nombre, email, rol, estado, creado_en
                    """,
                    (nombre, email, new_hash, user_id)
                )
            else:
                cur.execute(
                    """
                    UPDATE usuarios SET nombre=%s, email=%s
                    WHERE id=%s
                    RETURNING id, nombre, email, rol, estado, creado_en
                    """,
                    (nombre, email, user_id)
                )

            updated = cur.fetchone()
            conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'user': {
                'id':        updated[0],
                'nombre':    updated[1],
                'email':     updated[2],
                'rol':       updated[3],
                'estado':    updated[4],
                'creado_en': updated[5].isoformat() if updated[5] else None,
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ════════════════════════════════════════════════
#  REGISTRO COMO MODERADOR (desde dashboard profesor)
#
#  Agrega esta variable de entorno a tu .env:
#  MOD_SECRET_CODE=tu_codigo_secreto
# ════════════════════════════════════════════════

MOD_SECRET_CODE = os.getenv('MOD_SECRET_CODE', 'luta2025mod')

@app.route('/api/register-moderador', methods=['POST'])
def register_moderador():
    """
    Convierte un usuario existente (profesor) en moderador
    si provee el código secreto correcto.
    """
    data    = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    codigo  = (data.get('codigo') or '').strip()

    if not user_id or not codigo:
        return jsonify({'success': False, 'message': 'Faltan campos obligatorios'}), 400

    if codigo != MOD_SECRET_CODE:
        return jsonify({'success': False, 'message': 'Código de autorización incorrecto'}), 403

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE usuarios SET rol = 'moderador', estado = 'activo'
                WHERE id = %s
                RETURNING id, nombre, email, rol, estado
                """,
                (user_id,)
            )
            row = cur.fetchone()
            conn.commit()
        conn.close()

        if not row:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

        return jsonify({
            'success': True,
            'user': {
                'id':     row[0],
                'nombre': row[1],
                'email':  row[2],
                'rol':    row[3],
                'estado': row[4],
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ════════════════════════════════════════════════
#  DIAGRAMAS — lectura y borrado para moderador
# ════════════════════════════════════════════════

@app.route('/api/mod/diagramas', methods=['GET'])
def mod_get_diagramas():
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, profesor_id, titulo, descripcion, nodos, tipo, creado_en "
                "FROM prof_diagramas ORDER BY creado_en DESC"
            )
            rows = cur.fetchall()
        conn.close()
        return jsonify({'success': True, 'diagramas': [
            {'id':r[0],'profesor_id':r[1],'titulo':r[2],'descripcion':r[3],
             'nodos':r[4],'tipo':r[5],'creado_en':r[6].isoformat() if r[6] else None}
            for r in rows
        ]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/mod/diagramas/<int:diag_id>', methods=['DELETE'])
def mod_delete_diagrama(diag_id):
    data   = request.get_json(silent=True) or {}
    mod_id = data.get('mod_id')
    if not mod_id or not _get_mod(mod_id):
        return jsonify({'success': False, 'message': 'No autorizado'}), 403
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('DELETE FROM prof_diagramas WHERE id=%s RETURNING id',(diag_id,))
            deleted = cur.fetchone()
            conn.commit()
        conn.close()
        if not deleted:
            return jsonify({'success': False, 'message': 'No encontrado'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    # DEBUG mode enabled temporarily to show full tracebacks in responses
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=True)
