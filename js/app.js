$(function () {
        var dataTable = $('#data-table').DataTable();
        var elementHeading = $("#el_connnections");
        var elementList = $("#elements_list");

        var sliderValues = [];

        var networkData = [];
        var network;
        var networkOptions;
        var gPhysics;

        var config = {
            currentFile: null,
            fileType: null,
            absolut_file: false,
            structures: false,
            fixLength: false,
            bioPath: {
                biochem_path: false,
                hide_on_biochem_path: false,
                dashed_lines: false
            },
            groups: true,
            reset: function () {
                this.structures = false;
                this.fixLength = false;
                this.bioPath = {
                    biochem_path: false,
                    hide_on_biochem_path: false,
                    dashed_lines: false
                };

                this.groups = true;
            }
        };


        var edgeWidthScaleFactor = 6;
        var edgeLengthScaleFactor = 10;
        var hullGroups = [];

        var initialOptions = {
            autoResize: true,
            height: "650px",
            width: "100%",
            configure: {
                enabled: false
            },
            interaction: {
                hover: true,
                navigationButtons: true

            },

            physics: {
                solver: "barnesHut",
                stabilization: {
                    enabled: true
                },
                barnesHut: {
                    centralGravity: 1,
                    gravitationalConstant: -25714,
                    springConstant: 0.01,
                    springLength: 200
                }
            },
            edges: {
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.3
                    }
                },
                font: {
                    face: 'Roboto, sans-serif'
                },
                width: 5,
                color: {
                    highlight: "#000"
                },
                smooth: {
                    enabled: true,
                    type: "discrete",
                    roundness: 0.8
                }
            },
            nodes: {
                color: "#97C2FC"
            },
            layout: {
                randomSeed: 1
            }
        };

        $("#accordion").tabs();
        $("#graphTables").tabs();

        window.onload = function () {
            loadExperimentFile("fe_data.csv");
        };

        String.prototype.isEmpty = function () {
            return (this.length === 0 || !this.trim());
        };

        function updateUI(sValue) {
            $("#phValueLable").html(sValue);
            updateEdges(sValue);
            if (config.fileType == "diff") {
                updateNodes(sValue);
            }
        }

        $("#step_left").click(function () {
            var val = parseInt(document.getElementById("phSlider").value) - 1;
            document.getElementById("phSlider").value = val;
            updateUI(sliderValues[val]);
            setConnectionsList(network.getSelection());

        });

        $("#step_rigth").click(function () {
            var val = parseInt(document.getElementById("phSlider").value) + 1;
            document.getElementById("phSlider").value = val;
            updateUI(sliderValues[val]);
            setConnectionsList(network.getSelection());
        });

        $("#phSlider").on("input change", function (data) {
            var index = data.currentTarget.value;
            if (index >= 0 && index <= 100) {
                updateUI(sliderValues[index]);
                try {
                    var selection = network.getSelection();
                    setConnectionsList(selection);
                } catch (e) {
                    //not yet initialized e.g. no edge selected or a node was selected
                }
            }
        });


        function destroy() {
            if (network != null && typeof network != "undefined") {
                network.destroy();
                network = null;
            }
            if (dataTable != null) {
                dataTable.clear();
            }
            config.reset();
            setConfig();
        }

        function initNetwork() {
            var container = document.getElementById('cy');
            networkData = {
                nodes: new vis.DataSet(),
                edges: new vis.DataSet()
            };
            network = new vis.Network(container, networkData, initialOptions);
            attachNetworkListeners();
        }

        function sortSelection(val, data) {
            data.sort(function (a, b) {
                if (!a.chemScale && !b.chemScale) {
                    if (a.rates[val] == b.rates[val]) {
                        return 0;
                    }
                    return a.rates[val] > b.rates[val] ? -1 : 1;
                }
            });
            return data;
        }

        //nice
        function setConnectionsList(data) {
            var str = "";
            if ((!data.nodes || !data.edges) || (data.nodes.length == 0 && data.edges.length == 0)) {
                return; //nothing selected
            }
            var val = document.getElementById("phSlider").value;
            var connectedNodes = network.getConnectedNodes(data.edges);
            if (val >= 101) {
                val = 100;
            }
            var index = sliderValues[val];

            if (data.nodes.length == 0) { //edge selected
                elementHeading.html("Edge: " + connectedNodes[0] + "->" + connectedNodes[1]);
                connectedNodes = networkData.edges.get(network.getSelectedEdges())[0];
                if (!connectedNodes.chemScale) {
                    str = "<li><div class='connContainer'><b>pH <div id='conListIndex' style='display:inline;'>" + index + "</div>  :</b> <div id='conListValue'  style='display:inline;'>" + connectedNodes.rates[val] + "</div></div> </li>";
                }
            } else {
                elementHeading.html("Node: " + data.nodes[0]);
                data = networkData.edges.get(data.edges);
                data = sortSelection(val, data);

                for (var key in data) {
                    if (!data[key].hidden) {
                        var conNodes = network.getConnectedNodes(data[key].id);
                        try {
                            str += "<li><div class='connContainer'><b>" + conNodes[0] + "->" + conNodes[1] + "<div id='conListValue'  style='display:inline;'>:</b> " + data[key].rates[val] + "</div></div> </div></li>";
                        } catch (e) {
                            //biochem path -> no values
                        }
                    }
                }
            }
            elementList.html(str);
        }

        function attachNetworkListeners() {
            network.on('select', setConnectionsList);
        }

        $('#data-table tbody').on('click', 'tr', function (event) {
            dataTable.$('tr.selected').removeClass('selected');
            $(this).toggleClass('selected');
            var selected = dataTable.row('.selected');
            var edges = selected.data()[0].toString().split("–>");
            network.selectNodes(edges, true);
            setConnectionsList(network.getSelection());
        });

        function processData(allText) {
            allText = allText.replace(/\"/g, '');
            var lines = allText.split(/\r\n|\n/);
            var entries = [];
            var nodes = [];

            sliderValues = lines.splice(0, 1).pop().split(" ");
            if (config.absolut_file) {
                sliderValues = sliderValues.splice(1, sliderValues.length);
            }

            $("#phSlider").attr("min", 0);
            $("#phSlider").attr("max", sliderValues.length);
            //$("#slider").slider("option", "values", sliderValues);
            lines.forEach(function (data) {
                if (data.isEmpty()) {
                    return;
                }

                entries = data.split(' ');
                if (config.absolut_file) {
                    entries = entries.splice(1, entries.length);
                }
                var node = entries[0].split("->");
                //"F16BP->Glu"
                node[0] = replaceRu5P(node[0]);
                node[1] = replaceRu5P(node[1]);

                var name = node[0] + node[1];
                var rates = entries.splice(1, entries.length);
                for (var i = 0; i < rates.length; i++) {
                    rates[i] = Math.round10(rates[i], -3);
                }

                nodes.push({
                    name: name,
                    data: {
                        src: node[0],
                        dst: node[1],
                        values: rates
                    }
                });
            });
            return nodes;
        }

        function buildGraph(elements) {
            var fixLength = document.getElementById("fixLength").checked;
            var fileDiff = config.fileType == "diff";

            var tmp = [];
            var edge, tmpValue;
            if (fileDiff) {
                var options = {
                    edges: {
                        arrows: {
                            to: {
                                enabled: true,
                                scaleFactor: 1
                            }
                        }
                    }
                };
                network.setOptions(options);
            }

            elements.forEach(function (element) {

                tmp.push({
                    id: element.data.src,
                    label: element.data.src
                });

                tmp.push({
                    id: element.data.dst,
                    label: element.data.dst
                });
                try {
                    tmpValue = element.data.values[0];
                } catch (e) {
                    tmpValue = 1;
                }

                edge = createElement(fileDiff, fixLength, false, tmpValue);
                edge.from = element.data.src;
                edge.to = element.data.dst;

                if (element.data.chemScale) {
                    edge.color = "green";
                    edge.hidden = true;
                    edge.dashes = config.bioPath.dashed_lines;
                    edge.width = 3;
                    edge.chemScale = true;
                    edge.arrows = {
                        to: {
                            enabled: false
                        }
                    };
                } else {
                    edge.chemScale = false;
                    edge.rates = element.data.values;
                }
                networkData.edges.add(edge);
            });

            var uniqueNodes = _.uniq(tmp, function (node) {
                return node.id;
            });

            uniqueNodes.forEach(function (data) {
                if (config.structures) {
                    data.shape = "circularImage";
                    data.image = "mol_icons/" + data.id.toLowerCase() + ".png";
                    data.size = 25;
                    data.title = "<img src='mol_icons/" + data.id.toLowerCase() + ".png'  style='height:123px;width:100px'>";
                }
                networkData.nodes.add(data);
            });

            networkData = {edges: networkData.edges, nodes: networkData.nodes};
            network.setData(networkData);
        }


        function replaceRu5P(stringValue) {
            try {
                if (stringValue.indexOf("Ru5P") == 0) {
                    return stringValue.replace("Ru5P", "X5PRu5P");
                }
            } catch (e) {

            }
            return stringValue;
        }

        function createDatatable() {
            var newRow;
            var tmpValue;
            dataTable.clear();
            networkData.edges.forEach(function (data) {
                if (!data.chemScale) {
                    tmpValue = data.rates[0];
                    newRow = [
                        data.from + "–>" + data.to, ((typeof tmpValue === 'undefined') ? "NaN" : tmpValue)
                    ];
                    dataTable.row.add(newRow);
                }
            });
            dataTable.draw();
        }

        function updateListStyle(clear) {
            var color = "white";
            var groups = network.groups.groups;
            for (var key in groups) {
                if (clear) {
                    color = groups[key].color.background;
                }
                $("#" + key).css("background-color", color);
            }
        }

        function processBiochemichPath(data) {
            var biochemPath = [];
            var entries = data.split("\n");
            var lines = entries.splice(1, entries.length);
            lines.forEach(function (line) {
                line = line.split(",")[0].split("->");
                if (line.length > 1) {
                    biochemPath.push({
                        name: line[0] + line[1],
                        data: {
                            src: line[0],
                            dst: line[1],
                            chemScale: true
                        }
                    });
                }
                ;
            });
            return biochemPath;
        }

        function processHullData(data) {
            var lines = data.split(";");
            lines.forEach(function (line) {
                line = line.split(",");
                var groupName = line[0];
                line.splice(1, line.length).forEach(function (entry) {
                    hullGroups[entry] = groupName;
                });
            });
            return hullGroups;
        }

        function getGroup(nodeId) {
            return hullGroups[nodeId];
        }

        //holy moly
        function createGroupList(groups) {
            var tmp = [];
            for (var key in groups) {
                groups[key] = groups[key].replace(/(\r\n|\n|\r)/gm, "");
                if (tmp[groups[key]] == null) {
                    tmp[groups[key]] = [];
                }
                tmp[groups[key]].push(key);
            }
            var list = "<ul>";
            for (var key in tmp) {
                list += "<li class='group-item' id=" + $.trim(key.toLowerCase().replace(" ", "")) + "><b>" + key + "<div style='float:right'>" + tmp[key].length + "</div></b></li><ul>";
                tmp[key].forEach(function (subEntry) {
                    list += "<li id='node'>" + subEntry + "</li>";
                });
                list += "</ul>";
            }
            list += "</ul>";
            $("#groupList").html(list);
        }

        function loadGroups(biochems, filename) {
            $.ajax({
                url: 'files/hull_groups.csv',
                success: function (data) {
                    loadExperiment(biochems, filename);
                    processHullData(data);
                    createGroupList(hullGroups);
                }
            });
        }

        function loadBioChemPath(filename) {
            $.ajax({
                url: 'files/biochem_pathways.csv',
                success: function (data) {
                    var biochems = processBiochemichPath(data);
                    loadGroups(biochems, filename);
                }
            });
        }

        function loadExperiment(biochems, filename) {
            filename = config.currentFile = filename.toLowerCase();
            var scaling = document.getElementById("disable_reaction").checked;
            if (scaling) {
                filename = "abs_" + filename;
                config.absolut_file = true;
            } else {
                config.absolut_file = false;
            }

            $.get('experiments/' + filename, function (data) {
                initNetwork();
                if (filename.indexOf("fe_data") >= 0) {
                    config.fileType = "fe_data";
                }
                if (filename.indexOf("diff") >= 0) {
                    config.fileType = "diff";
                }
                if (filename.indexOf("ad") >= 0) {
                    config.fileType = "ad";
                }

                config.bioPath.biochem_path = document.getElementById("biochem_path_id").checked;
                config.structures = document.getElementById("structure_checkbox").checked;
                config.groups = document.getElementById("convex_hulls_id").checked;
                $("#graphTables").tabs("option", "active", 0);
                var loadedRates = processData(data);
                var merged = biochems.concat(loadedRates);
                buildGraph(merged);
                updateListStyle(config.groups);
                createDatatable();
                //holy inefficiency
                updateNodes("3");
                updateListStyle(config.groups);
            });
        }

        function readConfig() {
            config = {
                structures: document.getElementById("structure_checkbox").checked,
                fixLength: document.getElementById("fixLength").checked,
                bioPath: {
                    biochem_path: document.getElementById("biochem_path_id").checked,
                    hide_on_biochem_path: false,
                    dashed_lines: false
                },
                groups: document.getElementById("convex_hulls_id").checked
            };
        }

        function setConfig() {
            document.getElementById("convex_hulls_id").checked = config.groups;
            document.getElementById("structure_checkbox").checked = config.structures;
            document.getElementById("fixLength").checked = config.fixLength;
            document.getElementById("biochem_path_id").checked = config.bioPath.biochem_path;
            document.getElementById("hide_graph_id").checked = config.bioPath.biochem_path;
            document.getElementById("dashed_lines_id").checked = config.bioPath.biochem_path;
            $("#bioChemAddOptions").hide();
        }

        function loadExperimentFile(filename) {
            destroy();
            loadBioChemPath(filename);
        }

        initNetwork();

        function getNodeColor(forValue) {

        }

        function getColor(forValue) {
            var color;
            if (!(config.fileType == "diff") && forValue > 0) {
                forValue = forValue * -1;//hackedy hack
            }

            if (forValue < 0) {
                color = "rgba(0, 0, 0," + ((( forValue * -1 ) + 0.1) ) + ")";
            } else if (forValue == 0) {
                color = "rgba(255, 255, 255,0.8)";
            } else {
                if (typeof forValue == "undefine") {
                    forValue = 0.1;
                }
                color = "rgba(255, 0, 0," + ((forValue ) + 0.1) + ")";
            }
            return color;
        }

        function updateNodes(sValue) {
            var index = sliderValues.indexOf(sValue);
            var node;

            networkData.nodes.forEach(function (data) {
                node = {
                    id: data.id,
                    color: {
                        border: getColor(data[index])
                    }
                };
                if (config.structures && node.id != null) {
                    node.shape = "circularImage";
                    node.image = "mol_icons/" + node.id.toLowerCase() + ".png";
                    node.title = "<img src='mol_icons/" + node.id.toLowerCase() + ".png'  style='height:100px;width:100px'>";
                    node.size = 30;
                } else {
                    node.size = 35;
                    node.shape = "ellipse";
                }

                if (config.groups && node.id != null) {
                    node.group = getGroup(node.id).replace(" ", "").toLowerCase();
                } else {
                    delete node.group;
                    node.color = initialOptions.nodes.color;
                }
                networkData.nodes.update(node);
            });
        }

        function updateEdges(sValue) {
            var index = sliderValues.indexOf(sValue);
            var i = 0;
            var value;
            var fixLength = document.getElementById("fixLength").checked;
            var chemScaling = config.bioPath.biochem_path;
            var fileDiff = config.fileType == "diff";
            if (index >= 0) {
                networkData.edges.forEach(function (data) {
                    if (!data.chemScale) {
                        value = data.rates[index];
                        var tmp = [dataTable.row(i).data()[0], value];
                        dataTable.row(i).data(tmp);
                        i++;
                    } else {
                        value = 1;
                    }
                    networkData.edges.update(updateElement(data, fileDiff, fixLength, chemScaling, value));
                });
            }
        }

        function createElement(fileDiff, fixLength, chemScaling, value) {
            return updateElement({}, fileDiff, fixLength, chemScaling, value);
        }

        function updateElement(edge, fileDiff, fixLength, chemScaling, value) {
            edge.hidden = !!config.bioPath.hide_on_biochem_path; //okay
            if (edge.chemScale && chemScaling) {
                edge.hidden = false;
                edge.dashes = config.bioPath.dashed_lines;
                return edge;
            } else if (edge.chemScale && !chemScaling) {
                edge.dashes = config.bioPath.dashed_lines;
                edge.hidden = true;
                return edge;
            }

            edge.color = getColor(value);
            edge.width = 3;

            if (!fileDiff) {
                edge.width = (value * edgeWidthScaleFactor) + 3;
                if (!fixLength) {
                    edge.length = (Math.pow(Math.abs(value) * edgeLengthScaleFactor, 2) * -1) + 75;
                }
            }

            if (config.absolut_file) {
                edge.width = (value * edgeWidthScaleFactor) + 5;
                edge.arrows = {
                    to: {
                        enabled: true,
                        scaleFactor: 0.2
                    }
                };
            }
            return edge;
        }

        var animating = false;
        var i = 0;
        var speed = document.getElementById("speed_slider").value;

        $("#speed_slider").on("input change", function (event) {
            speed = event.currentTarget.value;
        });

        $("#stopAnimation").click(function (event) {
            resetAnimation();
        });

        $("#animatGraph").click(function (event) {
            if (!animating) {
                $("#playButton").switchClass("fa-play", "fa-pause");
                animation();
            } else {
                $("#playButton").switchClass("fa-pause", "fa-play");
            }
            animating = !animating;
        });

        function resetAnimation() {
            $("#playButton").switchClass("fa-pause", "fa-play");
            animating = false;
            i = 0;
            setConnectionsList(network.getSelection());
        }

        function animation() {
            setTimeout(function () {
                updateUI(sliderValues[i]);
                $("#phSlider").attr("value", sliderValues[i]);
                i++;
                if (i < sliderValues.length && animating) {
                    animation();
                } else {
                    resetAnimation();
                }
            }, speed);
        }


        var fix = true;
        $("#fixGraph").on('click', function (event) {

            if (fix) {
                event.currentTarget.value = "Unlock Graph";
                network.setOptions({
                    physics: {
                        barnesHut: {
                            gravitationalConstant: 0,
                            centralGravity: 0,
                            springConstant: 0
                        }
                    }
                });
            } else {
                event.currentTarget.value = "Lock Graph";
                network.setOptions({
                        physics: {
                            barnesHut: {
                                centralGravity: 1,
                                gravitationalConstant: -25714,
                                springConstant: 0.01,
                                springLength: 150
                            }
                        }
                    }
                );
            }
            fix = !fix;
        });

        $("input:radio[name ='scaling-group']:radio").change(function (event) {
            var fileName = $("input:radio[name ='dataset-group']:checked").val();
            loadExperimentFile(fileName);
        });

        $("input[name=dataset-group]:radio").change(function (event) {
            loadExperimentFile(event.currentTarget.value);
        });

        $(':checkbox').change(function (event) {
            var value = sliderValues[document.getElementById("phSlider").value];
            switch (event.currentTarget.value) {
                case "dashed_lines":
                    config.bioPath.dashed_lines = event.currentTarget.checked;
                    updateEdges(value);
                    break;
                case "hide_graph":
                    config.bioPath.hide_on_biochem_path = event.currentTarget.checked;
                    updateEdges(value);
                    break;
                case "biochem_path":
                    config.bioPath.biochem_path = event.currentTarget.checked;

                    //hideSel.attr("value", config.bioPath.biochem_path);
                    if (config.bioPath.biochem_path) {
                        $("#bioChemAddOptions").show();
                    } else {
                        config.bioPath.hide_on_biochem_path = false;
                        config.bioPath.dashed_lines = false;
                        $("#hide_graph_id").prop("checked", false);
                        $("#dashed_lines_id").prop("checked", false);
                        $("#bioChemAddOptions").hide();
                    }
                    updateEdges(value);
                    break;
                case "structures":
                    config.structures = event.currentTarget.checked;
                    updateNodes(value);
                    break;
                case "convex_hulls":
                    config.groups = event.currentTarget.checked;
                    if (config.groups) {
                        $("#graphTables").tabs("option", "active", 1);
                    } else {
                        $("#graphTables").tabs("option", "active", 0);
                    }
                    updateNodes(value);
                    updateListStyle(config.groups);
                    break;
            }
        });


        $("#stabilize").on('click', function (event) {
            network.stabilize();
        });
        $("#reset").on('click', function (event) {
            var file = config.currentFile;
            destroy();
            loadExperimentFile(file);

        });

        $("#centralGravity").change(function (e) {
            var value = parseInt($("#centralGravity").val());
            network.setOptions({physics: {barnesHut: {centralGravity: value}}});
            network.stabilize();
        });
        $("#gravitationalConstant").change(function (e) {
            var value = parseInt($("#gravitationalConstant").val());
            network.setOptions({physics: {barnesHut: {gravitationalConstant: value}}});
        });
        $("#springLength").change(function (e) {
            var value = parseInt($("#springLength").val());
            network.setOptions({physics: {barnesHut: {springLength: value}}});
        });
        $("#springConstant").change(function (e) {
            var value = parseFloat($("#springConstant").val());
            network.setOptions({physics: {barnesHut: {springConstant: value}}});
        });
        $("#damping").change(function (e) {
            var value = parseFloat($("#damping").val());
            network.setOptions({physics: {barnesHut: {damping: value}}});
        });

        $("#avoidOverlap").change(function (e) {
            var value = parseInt($("#avoidOverlap").val());
            network.setOptions({physics: {barnesHut: {avoidOverlap: value}}});
        });

        $("#enableSmooth").change(function (e) {
            network.setOptions({
                edges: {
                    smooth: e.currentTarget.checked
                }
            });
        });
        $("#edgeStyelSelector").change(function (e) {
            var value = $("#edgeStyelSelector").val();
            network.setOptions({
                edges: {
                    smooth: {
                        type: value
                    }
                }
            });
        });

        $("#roundNess").change(function (e) {
            var value = parseFloat($("#roundNess").val());
            network.setOptions({
                edges: {
                    smooth: {
                        roundness: value
                    }
                }
            });
        });

        function fixGraph() {
            if (fix) {
                networkOptions.physics = gPhysics;
            } else {
                networkOptions.physics = {
                    barnesHut: {
                        gravitationalConstant: 0,
                        centralGravity: 0,
                        springConstant: 0
                    },
                    stabilization: {
                        enabled: false
                    }
                };
            }
            network.setOptions(networkOptions);
        }

        function decimalAdjust(type, value, exp) {
            if (typeof exp === 'undefined' || +exp === 0) {
                return Math[type](value);
            }
            value = +value;
            exp = +exp;
            if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
                return NaN;
            }
            value = value.toString().split('e');
            value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
            value = value.toString().split('e');
            return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
        }

        if (!Math.round10) {
            Math.round10 = function (value, exp) {
                return decimalAdjust('round', value, exp);
            };
        }
    }
)
;
