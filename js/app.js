//need refactoring
$(function () {
        var gData;
        var uniqueGData = [];
        var sliderValues = [];
        var networkData = [];
        var dataTable = $('#data-table').DataTable();
        var network;
        var networkOptions;
        var elementHeading = $("#el_connnections");
        var elementList = $("#elements_list");
        var gPhysics;
        var config = [];
        config["structures_tooltips"] = true;

        var edgeWidthScaleFactor = 6;
        var edgeLengthScaleFactor = 10;
        var hullGroups = [], biochemPath = [];
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
                    gravitationalConstant: -25714
                }
            },
            edges: {
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.3
                    }
                },
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

        function setLableValue(sValue) {
            $("#phValueLable").html(sValue);
            if (typeof gData !== 'undefined') {
                updateEdgesWidth(sValue);
                if (config["file_diff"]) {
                    updateNodes(sValue);
                }
            }
        }

        $("#step_left").click(function () {
            var val = parseInt(document.getElementById("phSlider").value) - 1;
            document.getElementById("phSlider").value = val;
            setLableValue(sliderValues[val]);
            setConnectionsList(network.getSelection());

        });

        $("#step_rigth").click(function () {
            var val = parseInt(document.getElementById("phSlider").value) + 1;
            document.getElementById("phSlider").value = val;
            setLableValue(sliderValues[val]);
            setConnectionsList(network.getSelection());
        });

        $("#phSlider").on("input change", function (data) {
            var index = data.currentTarget.value;
            if (index >= 0 && index <= 100) {
                setLableValue(sliderValues[index]);
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

        function sortSelection(data) {
            //console.log(data);
            //TODO
            return data;
        }

        //nice
        function setConnectionsList(data) {
            var str = "";
            if ((!data.nodes || !data.edges) || (data.nodes.length == 0 && data.edges.length == 0)) {
                return; //nothing selected
            }
            var val = document.getElementById("phSlider").value;
            var index = sliderValues[val];
            var edges = network.getConnectedNodes(data.edges);
            var edgeIndex = edges[0] + edges[1];
            if (val >= 101) {
                val = 100;
            }
            if (data.nodes.length == 0) { //edge selected
                elementHeading.html("Edge: " + edges[0] + "->" + edges[1]);
                try {
                    str = "<li><div class='connContainer'><b>pH <div id='conListIndex' style='display:inline;'>" + index + "</div>  :</b> <div id='conListValue'  style='display:inline;'>" + gData[edgeIndex].values[val] + "</div></div> </li>";
                } catch (e) {
                    //biochem path
                }
            } else {
                elementHeading.html("Node: " + data.nodes[0]);
                data = sortSelection(data);

                data.edges.forEach(function (edge) {
                    edge = networkData.edges.get(edge);
                    if (!edge.hidden) {
                        var conNodes = network.getConnectedNodes(edge.id);
                        var con = conNodes[0] + conNodes[1];
                        try {
                            str += "<li><div class='connContainer'><b>" + conNodes[0] + "->" + conNodes[1] + "<div id='conListValue'  style='display:inline;'>:</b> " + gData[con].values[val] + "</div></div> </div></li>";
                        } catch (e) {
                            //biochem path -> no values
                        }
                    }
                });
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
            var conNodes = network.getConnectedNodes(edges[0]);
            setConnectionsList(network.getSelection());
        });

        function processData(allText) {
            allText = allText.replace(/\"/g, '');
            var lines = allText.split(/\r\n|\n/);
            var entries = [];
            var nodes = [];

            sliderValues = lines.splice(0, 1).pop().split(" ");
            if (config["absolut_file"]) {
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
                if (config["absolut_file"]) {
                    entries = entries.splice(1, entries.length);
                }
                //"F16BP->Glu"
                var node = entries[0].split("->");
                node[0] = replaceRu5P(node[0]);
                node[1] = replaceRu5P(node[1]);

                var name = node[0] + node[1];
                var rates = entries.splice(1, entries.length);
                for (var i = 0; i < rates.length; i++) {
                    rates[i] = Math.round10(rates[i], -3);
                }

                nodes[name] = {
                    src: node[0],
                    dst: node[1],
                    values: rates
                };
                uniqueGData[node[0]] = nodes[name];
            });
            return nodes;
        }

        function buildGraph(nodes) {
            var fixLength = document.getElementById("fixLength").checked;
            var fileDiff = config["file_diff"];

            var tmp = [];
            var edge;
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
            for (var key in nodes) {
                tmp.push({
                    id: nodes[key].src,
                    label: nodes[key].src
                });
                tmp.push({
                    id: nodes[key].dst,
                    label: nodes[key].dst
                });

                edge = createElement(fileDiff, fixLength, false, nodes[key].values[0]);
                edge.from = nodes[key].src;
                edge.to = nodes[key].dst;
                networkData.edges.add(edge);
            }
            createChemScaleEdges();
            var uniqueNodes = _.uniq(tmp, function (node) {
                return node.id;
            });

            uniqueNodes.forEach(function (data) {
                if (config["structures"]) {
                    data.shape = "circularImage";
                    data.image = "mol_icons/" + data.id.toLowerCase() + ".png";
                    data.size = 25;
                    data.title = "<img src='mol_icons/" + data.id.toLowerCase() + ".png'  style='height:80px;width:50px'>";
                }
                networkData.nodes.add(data);
            });

            networkData = {edges: networkData.edges, nodes: networkData.nodes};
            network.setData(networkData);
        }

        function createChemScaleEdges() {
            var edge;
            var nEdge;

            for (var key in biochemPath) {
                edge = createElement(false, true, true, 1);
                edge.from = biochemPath[key].src;
                edge.to = biochemPath[key].dst;
                edge.hidden = false;
                edge.color = "green";
                edge.hidden = true;
                edge.dashes = true;
                edge.chemScale = true;
                edge.width = 3;
                nEdge = networkData.edges.add(edge);

                delete biochemPath[key];
                biochemPath[nEdge] = true;
            }
        }

        function replaceRu5P(stringValue) {
            if (stringValue.indexOf("Ru5P") == 0) {
                return stringValue.replace("Ru5P", "X5PRu5P");
            }
            return stringValue;
        }

        function createDatatable() {
            var newRow;
            var tmpValue;
            dataTable.clear();
            networkData.edges.forEach(function (data) {
                if (!biochemPath[data.id]) {
                    var gEdge = gData[data.from + data.to];
                    tmpValue = gEdge.values[0];
                    newRow = [
                        data.from + "–>" + data.to,
                        ((typeof tmpValue === 'undefined') ? "NaN" : tmpValue)
                    ];
                    dataTable.row.add(newRow);
                }
            });
            dataTable.draw();
        }

        $(':checkbox').change(function (event) {
            var value = sliderValues[document.getElementById("phSlider").value];
            switch (event.currentTarget.value) {
                case "structure_tooltip_checkbox":
                    config["structures_tooltips"] = event.currentTarget.checked;
                    updateNodes(value);
                    break;
                case "hide_graph":
                    config["hide_on_biochem_path"] = event.currentTarget.checked;
                    updateEdgesWidth(value);
                    break;
                case "biochem_path":
                    config["biochem_path"] = event.currentTarget.checked;
                    var hideSel = $("#hide_graph_label");  //hahahahahahaha
                    hideSel.attr("value", config["biochem_path"]);
                    if (config["biochem_path"]) {
                        hideSel.show();
                    } else {
                        config["hide_on_biochem_path"] = false;
                        $("#hide_graph_id").prop("checked", false);
                        hideSel.hide();
                    }
                    updateEdgesWidth(value);
                    break;
                case "structures":
                    config["structures"] = event.currentTarget.checked;
                    updateNodes(value);
                    break;
                case "convex_hulls":
                    config["groups"] = event.currentTarget.checked;
                    if (config["groups"]) {
                        $("#graphTables").tabs("option", "active", 1);
                    } else {
                        $("#graphTables").tabs("option", "active", 0);
                    }
                    updateNodes(value);
                    updateListStyle(config["groups"]);
                    break;
            }
        });

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

        $("input:radio[name ='scaling-group']:radio").change(function (event) {
            var fileName = $("input:radio[name ='dataset-group']:checked").val();
            loadExperimentFile(fileName);
        });

        $("input[name=dataset-group]:radio").change(function (event) {
            loadExperimentFile(event.currentTarget.value);
        });

        function processBiochemichPath(data) {
            biochemPath = {};
            var entries = data.split("\n");
            var lines = entries.splice(1, entries.length);
            lines.forEach(function (line) {
                line = line.split(",")[0].split("->");
                if (line.length > 1) {
                    biochemPath[line[0] + line[1]] = {
                        src: line[0],
                        dst: line[1]
                    };
                }
            });
            return biochemPath;
        }

        function getGroup(nodeId) {
            return hullGroups[nodeId];
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

        function loadBioChemPath() {
            if (typeof biochemPath != "undefined" && biochemPath.length <= 0) {
                $.ajax({
                    url: 'files/biochem_pathways.csv',
                    async: false,
                    success: function (data) {
                        biochemPath = processBiochemichPath(data);
                    }
                });
            }
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

        function loadGroups() {
            if (typeof hullGroups != "undefined" && hullGroups.length <= 0) {
                $.ajax({
                    url: 'files/hull_groups.csv',
                    async: false,
                    success: function (data) {
                        hullGroups = processHullData(data);
                        createGroupList(hullGroups);
                    }
                });
            }
        }

        function loadExperimentFile(filename) {
            filename = filename.toLowerCase();
            var scaling = $("input:radio[name ='scaling-group']:checked").val();
            if (scaling == "none") {
                filename = "abs_" + filename;
                config["absolut_file"] = true;
            } else {
                config["absolut_file"] = false;
            }

            $.get('experiments/' + filename, function (data) {
                //Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check http://xhr.spec.whatwg.org/.
                //well duh still those need to be loaded first...
                loadGroups();
                loadBioChemPath();

                destroy();
                initNetwork();
                filename = filename.toLowerCase();
                config["file_diff"] = filename.indexOf("diff") >= 0;
                config["file_ad"] = filename.indexOf("ad");
                config["file_fe"] = filename.indexOf("fe_data");
                config["biochem_path"] = document.getElementById("biochem_path_id").checked;
                config["structures"] = document.getElementById("structure_checkbox").checked;
                config["groups"] = document.getElementById("convex_hulls_id").checked;
                $("#graphTables").tabs("option", "active", 0);
                gData = processData(data);
                buildGraph(gData);
                updateListStyle(config["groups"]);
                createDatatable();
                //holy inefficiency
                updateNodes("3");
                updateListStyle(config["groups"]);
            });
        }

        function init(data) {
            //Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check http://xhr.spec.whatwg.org/.
            //well duh still those need to be loaded first...
            loadGroups();
            loadBioChemPath();

            destroy();
            initNetwork();
            filename = filename.toLowerCase();
            config["file_diff"] = filename.indexOf("diff") >= 0;
            config["file_ad"] = filename.indexOf("ad");
            config["file_fe"] = filename.indexOf("fe_data");
            config["biochem_path"] = document.getElementById("biochem_path_id").checked;
            config["structures"] = document.getElementById("structure_checkbox").checked;
            config["groups"] = document.getElementById("convex_hulls_id").checked;
            $("#graphTables").tabs("option", "active", 0);
            gData = processData(data);
            buildGraph(gData);
            updateListStyle(config["groups"]);
            createDatatable();
            //holy inefficiency
            updateNodes("3");
            updateListStyle(config["groups"]);
        }

        initNetwork();

        function getNodeColor(forValue) {

        }

        function getColor(forValue) {
            var color;

            if (!config["file_diff"] && forValue > 0) {
                forValue = forValue * -1;//hackedy hack
            }

            if (forValue < 0) {
                color = "rgba(0, 0, 0," + (( forValue * -1 ) ) + ")";
            } else if (forValue == 0) {
                color = "rgba(255, 255, 255,0.8)";
            } else {
                if (typeof forValue == "undefine") {
                    forValue = 0.1;
                }
                color = "rgba(255, 0, 0," + (forValue ) + ")";
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
                if (config["structures"] && node.id != null) {
                    node.shape = "circularImage";
                    node.image = "mol_icons/" + node.id.toLowerCase() + ".png";
                    node.title = "<img src='mol_icons/" + node.id.toLowerCase() + ".png'  style='height:80px;width:50px'>";
                    node.size = 30;
                } else {
                    node.size = 35;
                    node.shape = "ellipse";
                }

                if (config["groups"] && node.id != null) {
                    node.group = getGroup(node.id).replace(" ", "").toLowerCase();
                } else {
                    delete node.group;
                    node.color = initialOptions.nodes.color;
                }
                networkData.nodes.update(node);
            });
        }

        function getObjects(key, val) {
            var objects = [];
            for (var i in gData) {
                if (!gData[i].hasOwnProperty(i)) continue;
                if (typeof gData[i] == 'object') {
                    objects = objects.concat(getObjects(gData[i], key, val));
                } else if (i == key && gData[key] == val) {
                    objects.push(gData);
                }
            }
            return objects;
        }

        function updateEdgesWidth(sValue) {
            var index = sliderValues.indexOf(sValue);
            var i = 0;
            var value, gEdge;
            var fixLength = document.getElementById("fixLength").checked;
            var chemScaling = config["biochem_path"];
            var fileDiff = config["file_diff"];
            if (index >= 0) {
                var fromTo;
                networkData.edges.forEach(function (data) {
                    fromTo = data.from + data.to;
                    gEdge = gData[fromTo];
                    try {
                        if (!biochemPath[data.id]) {
                            value = gEdge.values[index];
                            var tmp = [dataTable.row(i).data()[0], value];
                            dataTable.row(i).data(tmp);
                        }
                    } catch (e) {
                        console.log(e, i);
                        value = 1;
                    }
                    networkData.edges.update(updateElement(data, fileDiff, fixLength, chemScaling, value));
                    i++;
                });
            }
        }

        function createElement(fileDiff, fixLength, chemScaling, value) {
            return updateElement({}, fileDiff, fixLength, chemScaling, value);
        }

        function updateElement(edge, fileDiff, fixLength, chemScaling, value) {
            if (config["hide_on_biochem_path"]) {
                edge.hidden = true;
            } else {
                edge.hidden = false;
            }
            if (edge.id in biochemPath && chemScaling) {
                edge.hidden = false;
                return edge;
            } else if (edge.id in biochemPath && !chemScaling) {
                edge.hidden = true;
                return edge;
            }

            edge.color = getColor(value);
            edge.width = 3;

            if (!fileDiff) {
                edge.width = (value * edgeWidthScaleFactor) + 1;
                if (!fixLength) {
                    edge.length = (Math.pow(Math.abs(value) * edgeLengthScaleFactor, 2) * -1) + 75;
                }
            }

            if (config["absolut_file"]) {
                edge.width = (value * edgeWidthScaleFactor) + 5;
                edge.arrows = {
                    to: {
                        enabled: true,
                        scaleFactor: 0.3
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
                event.currentTarget.value = "Pause";
                animation();
            } else {
                event.currentTarget.value = "Start";
            }
            animating = !animating;
        });

        function resetAnimation() {
            $("#animatGraph").attr("value", "Start");
            animating = false;
            i = 0;
        }

        function animation() {
            setTimeout(function () {
                setLableValue(sliderValues[i]);
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
                                springConstant: 0.04,
                                springLength: 95
                            }
                        }
                    }
                );
            }

            fix = !fix;
        });


        $("#stabilize").on('click', function (event) {
            network.stabilize();
        });
        $("#reset").on('click', function (event) {
            network.setOptions(initialOptions);
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

        $.fn.waitUntilExists = function (handler, shouldRunHandlerOnce, isChild) {
            var found = 'found';
            var $this = $(this.selector);
            var $elements = $this.not(function () {
                return $(this).data(found);
            }).each(handler).data(found, true);
            if (!isChild) {
                (window.waitUntilExists_Intervals = window.waitUntilExists_Intervals || {})[this.selector] =
                    window.setInterval(function () {
                        $this.waitUntilExists(handler, shouldRunHandlerOnce, true);
                    }, 500)
                ;
            }
            else if (shouldRunHandlerOnce && $elements.length) {
                window.clearInterval(window.waitUntilExists_Intervals[this.selector]);
            }
            return $this;
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
