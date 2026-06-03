let cyInstance = null;

// Aseguramos que todo el HTML esté cargado antes de ejecutar NADA
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Ajuste forzado del contenedor
    const cyDiv = document.getElementById('cy');
    cyDiv.style.width = '100vw';
    cyDiv.style.height = '100vh';
    cyDiv.style.position = 'absolute';
    cyDiv.style.top = '0';
    cyDiv.style.left = '0';

    // 2. Vincular el botón de cerrar tarjeta AHORA que sabemos que existe
    const btnCerrar = document.getElementById('closeCard');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', ocultarTarjeta);
    }

    // 3. Cargar los datos
    if (typeof graphData !== 'undefined') {
        procesarGrafo(graphData);
    } else {
        console.error("Variable graphData no encontrada.");
    }
});

function procesarGrafo(data) {
    const elementos = [];
    const posiciones = data.positions || {};
    const nodosExistentes = new Set(Object.keys(posiciones));

    // Nodos
    for (const key in posiciones) {
        const pos = posiciones[key];
        let color = '#ef4444'; // High
        if (pos.riskLevel === 'Medium') color = '#f59e0b';
        if (pos.riskLevel === 'Low') color = '#10b981';

        elementos.push({
            group: 'nodes',
            data: {
                id: key,
                label: pos.name || key,
                type: pos.positionType || 'Desconocido',
                risk: pos.riskLevel || 'N/A',
                energy: pos.energyCost || 'N/A',
                desc: pos.description || 'Sin descripción disponible.',
                color: color
            }
        });
    }

    // Aristas (Transiciones)
    for (const key in posiciones) {
        const pos = posiciones[key];
        if (pos.transitions) {
            pos.transitions.forEach((trans, index) => {
                if (trans.target) {
                    if (!nodosExistentes.has(trans.target)) {
                        nodosExistentes.add(trans.target);
                        elementos.push({
                            group: 'nodes',
                            data: {
                                id: trans.target,
                                label: trans.target.replace(/-/g, ' '),
                                type: 'Faltante',
                                risk: '?',
                                energy: '?',
                                desc: 'Nodo mencionado en transición, pero sin datos.',
                                color: '#4b5563'
                            }
                        });
                    }
                    elementos.push({
                        group: 'edges',
                        data: {
                            id: `edge-${key}-${trans.target}-${index}`,
                            source: key,
                            target: trans.target,
                            label: trans.technique || ''
                        }
                    });
                }
            });
        }
    }

    // Dibujar Cytoscape
    cyInstance = cytoscape({
        container: document.getElementById('cy'),
        elements: elementos,
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(color)',
                    'label': 'data(label)',
                    'color': '#ffffff',
                    'font-size': '12px',
                    'text-valign': 'bottom',
                    'text-margin-y': '8px',
                    'width': '45px',
                    'height': '45px',
                    'text-outline-width': 2,
                    'text-outline-color': '#000',
                    'cursor': 'pointer'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#444',
                    'target-arrow-color': '#444',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'label': 'data(label)',
                    'font-size': '9px',
                    'color': '#aaa',
                    'text-rotation': 'autorotate',
                    'text-background-opacity': 1,
                    'text-background-color': '#040404'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': '4px',
                    'border-color': '#ffffff'
                }
            }
        ],
        layout: {
            name: 'cose',
            idealEdgeLength: 150,
            nodeOverlap: 20,
            fit: true,
            padding: 50
        }
    });

    // ==========================================
    // EVENTOS DE CLIC CORREGIDOS
    // ==========================================
    cyInstance.on('tap', 'node', function(evt){
        const nodeData = evt.target.data();
        console.log("Clic detectado en:", nodeData); // Útil para ver en F12 si funciona
        mostrarTarjeta(nodeData);
    });

    cyInstance.on('tap', function(evt){
        if(evt.target === cyInstance) {
            ocultarTarjeta();
        }
    });
}

function mostrarTarjeta(data) {
    // Llenar los datos
    document.getElementById('nodeTitle').innerText = data.label;
    document.getElementById('nodeType').innerText = data.type;
    
    const riskBadge = document.getElementById('nodeRisk');
    riskBadge.innerText = data.risk;
    riskBadge.style.backgroundColor = data.color;
    
    document.getElementById('nodeEnergy').innerText = data.energy;
    document.getElementById('nodeDesc').innerText = data.desc;
    
    // Forzar la visibilidad (sobreescribe cualquier problema de CSS)
    const card = document.getElementById('detailCard');
    card.classList.remove('hidden');
    card.style.display = 'block';
    card.style.opacity = '1';
    card.style.pointerEvents = 'auto';
    card.style.transform = 'translateX(0)';
    card.style.zIndex = '9999'; // Asegura que esté por encima de todo
}

function ocultarTarjeta() {
    const card = document.getElementById('detailCard');
    card.classList.add('hidden');
    card.style.opacity = '0';
    card.style.pointerEvents = 'none';
    card.style.transform = 'translateX(30px)';
}