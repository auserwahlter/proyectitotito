/*jslint browser: true, nomen: true */
/*global $, jsPlumb, jQuery*/

jsPlumb.ready(function() {
    'use strict';

    function FlowchartEditor($container) {
        this.$container = $container;
        this.$chartStorage = $container.find('input[data-chart-storage=true]').filter(':first');
        this.$workspace = $container.find('.workspace');
    }

    FlowchartEditor.prototype.getChartData = function() {
        var val = this.$chartStorage.val();
        if (!val) {
            return null;
        }
        try {
            return JSON.parse(val);
        } catch (e) {
            return null;
        }
    };

    FlowchartEditor.prototype.setChartData = function(value) {
        this.$chartStorage.val(JSON.stringify(value));
        this.$chartStorage.trigger('change');
        return this;
    };

    FlowchartEditor.prototype.jsPlumbDefaults = function() {
        jsPlumb.importDefaults({
            Endpoint: ['Dot', { radius: 1 }],
            EndpointStyle: { strokeStyle: 'transparent' },
            PaintStyle: { strokeStyle: '#0C768E', lineWidth: 1 },
            HoverPaintStyle: { strokeStyle: '#E26F1E', lineWidth: 1 },
            Connector: ['Flowchart', { cornerRadius: 0 }],
            RenderMode: 'svg',
            Anchor: 'Continuous',
            ConnectionOverlays: [
                ['Arrow', {
                    location: 1,
                    id: 'arrow',
                    length: 8,
                    width: 8,
                    foldback: 0.8
                }],
                ['Label', { label: $('#label-name').val() || '', id: 'label', cssClass: 'empty', location: 0.5 }]
            ]
        });
    };

    FlowchartEditor.prototype.setOverlays = function(connectionInstance, label) {
        var overlayLabel = connectionInstance.getOverlay('label');
        if (!overlayLabel) {
            return;
        }
        if (label === '') {
            overlayLabel.setLabel(label);
            overlayLabel.addClass('empty');
            overlayLabel.removeClass('aLabel');
        } else {
            overlayLabel.setLabel(label);
            overlayLabel.removeClass('empty');
            overlayLabel.addClass('aLabel');
        }
    };

    FlowchartEditor.prototype.setZoom = function(z) {
        var prefixes = ['-webkit-', '-moz-', '-ms-', '-o-', ''];
        var s = 'scale(' + z + ')';
        var i;

        for (i = 0; i < prefixes.length; i += 1) {
            this.$container.css(prefixes[i] + 'transform', s);
            this.$container.css(prefixes[i] + 'transform-origin', '0 0 0');
        }

        this.$container.find('.flowchart-zoom').attr('data-zoom', z);
        jsPlumb.setZoom(z);
    };

    FlowchartEditor.prototype.layoutAdmin = function() {
        var contentFields = this.$container.closest('.cms-content-fields');
        if (!contentFields.length) {
            return;
        }
        var height = contentFields.removeClass('auto-height').height();
        this.$container.find('.flowchart-wrap').height(height);
        this.$container.find('.new-states').height(height);
        contentFields.addClass('auto-height');
    };

    FlowchartEditor.prototype.workspaceInit = function() {
        var self = this;
        this.layoutAdmin();
        this.$workspace.css('position', 'relative');
        jsPlumb.setContainer(this.$workspace[0]);

        this.$container.find('.state').each(function() {
            var $state = $(this);
            var connect = $('<div>').addClass('connect');
            $state.append(connect);

            if ($state.closest('.workspace').length > 0) {
                jsPlumb.makeTarget(this, { anchor: 'Continuous' });
                jsPlumb.makeSource(connect[0], { parent: this, anchor: 'Continuous' });
            }

            $state.draggable({
                revert: $state.hasClass('new-state') ? 'invalid' : false,
                containment: $state.closest('.workspace').length > 0 ? 'parent' : 'body',
                start: function() {
                    $(this).css('position', 'absolute');
                },
                stop: function() {
                    self.storeFlowChart();
                }
            });
        });

        jsPlumb.unbind('click');
        jsPlumb.unbind('connection');
        jsPlumb.unbind('connectionDetached');

        jsPlumb.bind('click', jsPlumb.detach);
        jsPlumb.bind('connection', function(info) {
            var label = $('#label-name').val() || '';
            self.setOverlays(info.connection, label);
            self.storeFlowChart();
        });
        jsPlumb.bind('connectionDetached', function() {
            self.storeFlowChart();
        });

        this.$container.on('dblclick', '.state', function(e) {
            e.stopPropagation();
            jsPlumb.detachAllConnections(this);
            var $state = $(this);
            var $wrap = $state.closest('.flowchart-admin-wrap');
            $state.appendTo($wrap.find('.new-states')).attr('style', '').addClass('new-state');
            $state.draggable('option', 'containment', 'body');
            self.storeFlowChart();
        });
    };

    FlowchartEditor.prototype.storeFlowChart = function() {
        var saveArray = { states: [], connections: [] };
        this.$container.find('.state').each(function() {
            var $state = $(this);
            if ($state.closest('.workspace').length > 0) {
                saveArray.states.push({
                    id: $state.attr('id'),
                    x: $state.position().left,
                    y: $state.position().top
                });
            }
        });

        jsPlumb.getConnections().forEach(function(connection) {
            saveArray.connections.push({
                from: connection.targetId,
                to: connection.sourceId,
                label: connection.getOverlay('label').getLabel()
            });
        });

        this.setChartData(saveArray);
    };

    FlowchartEditor.prototype.loadFlowChart = function() {
        var savedFlow = this.getChartData();
        if (!savedFlow) {
            return false;
        }

        this.jsPlumbDefaults();
        jsPlumb.unbind();

        this.$container.find('.state').each(function() {
            jsPlumb.removeAllEndpoints(this);
        });

        savedFlow.states.forEach(function(state) {
            var $state = $('#' + state.id);
            if (!$state.length) {
                return;
            }
            if ($state.closest('.flowchart-admin-wrap').length > 0) {
                $state.appendTo($state.closest('.flowchart-admin-wrap').find('.workspace'));
            }
            $state.css({ left: state.x, top: state.y }).removeClass('new-state');
        });

        savedFlow.connections.forEach(function(connection) {
            if ($('#' + connection.from).length > 0 && $('#' + connection.to).length > 0) {
                var newConnection = jsPlumb.connect({ source: connection.to, target: connection.from });
                this.setOverlays(newConnection, connection.label);
            }
        }, this);
    };

    FlowchartEditor.prototype.init = function() {
        this.jsPlumbDefaults();
        this.loadFlowChart();
        this.initialized = false;
        if (this.$container.is(':visible') && this.$container.closest('.flowchart-admin-wrap').length > 0) {
            this.workspaceInit();
            this.initialized = true;
        }
        this.$container.data('flowchartEditor', this);
    };

    function initializeFlowcharts() {
        $('.flowchart-container').each(function() {
            var editor = new FlowchartEditor($(this));
            editor.init();
        });

        $('#open-flowchart-editor').on('click', function() {
            var $editorWrap = $('#flowchart-editor');
            var $container = $editorWrap.find('.flowchart-container');
            var editor = $container.data('flowchartEditor');
            setTimeout(function() {
                if (editor && !editor.initialized && $editorWrap.is(':visible')) {
                    editor.workspaceInit();
                    editor.initialized = true;
                }
            }, 0);
        });

        $('.flowchart-admin-wrap .workspace').droppable({
            accept: '.state',
            drop: function(e, ui) {
                var $draggable = ui.draggable;
                if ($draggable.hasClass('new-state')) {
                    var $workspace = $(this);
                    var workspaceOffset = $workspace.offset();
                    var left = ui.offset.left - workspaceOffset.left + $workspace.scrollLeft();
                    var top = ui.offset.top - workspaceOffset.top + $workspace.scrollTop();
                    $draggable.appendTo($workspace).removeClass('new-state');
                    $draggable.css({ position: 'absolute', left: left, top: top });
                    $draggable.draggable('option', 'containment', 'parent');

                    jsPlumb.makeTarget($draggable[0], { anchor: 'Continuous' });
                    jsPlumb.makeSource($draggable.find('.connect')[0], { parent: $draggable[0], anchor: 'Continuous' });

                    var editor = $workspace.closest('.flowchart-admin-wrap').find('.flowchart-container').data('flowchartEditor');
                    if (editor) {
                        editor.storeFlowChart();
                    }
                }
            }
        });

        $('.flowchart-zoom a').on('click', function() {
            var $zoom = $(this).closest('.flowchart-zoom');
            var currentZoom = parseFloat($zoom.attr('data-zoom')) || 1;
            var $container = $zoom.closest('.flowchart-container');
            var editor = $container.data('flowchartEditor');
            if (!editor) {
                return false;
            }
            if ($(this).hasClass('zoom-in')) {
                editor.setZoom(currentZoom + 0.1);
            } else if ($(this).hasClass('zoom-out')) {
                editor.setZoom(currentZoom - 0.1);
            }
            return false;
        });
    }

    $(document).ready(function() {
        initializeFlowcharts();
    });
});
