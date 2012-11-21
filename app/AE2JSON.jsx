﻿{  // AE2JSON v0.5  //  // Author: Cole Reed  // Email: info@auralgrey.com  // https://github.com/ichabodcole  //  // Please report issues at https://github.com/ichabodcole/AE2JSON  //  // Copyright (c) 2012 Cole Reed. All rights reserved.     //  // Description:  // This script that provides the ability to export AE project data to JSON  //  // TODO (this is the short list)  //    Add comments  //    Add more exportable types  //    Export solids with mesh coordinates  //    Export shape layers with mesh coordinates  //    Add option to export 2d layers  //    Add Interface to select export settings  /*  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES   OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,   ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR   OTHER DEALINGS IN THE SOFTWARE.  */  #include "../lib/Logger.jsx";  #include "../lib/json2.js"  #include "../lib/utilities.js"  var L = new Logger();    function AE2JSON(thisObj) {    L.indentOn(false);    this.proj = app.project;    this.comp = app.project.activeItem;    this.jsonData = {};    this.jsonData.projectSettings = {};    this.jsonData.compositions = [];    this.jsonData.compositions[0] = {};    // create defaultComp until we export all project compositions    // and not just the current comp.    this.defaultComp = this.jsonData.compositions[0];    this.orgTimeDisplayType = this.proj.timeDisplayType;    this.proj.timeDisplayType = TimeDisplayType.FRAMES;    this.defaultComp.compSettings = new CompSettings(this.comp);    this.defaultComp.layers = [];    this.doCompLayers();    this.renderJSON();    this.proj.timeDisplayType = this.orgTimeDisplayType;  }  AE2JSON.prototype.checkLayerType = function(layer){    if(layer instanceof CameraLayer){      return "CAMERA";    }else if(layer instanceof LightLayer){      return "LIGHT";    }else if(layer.threeDLayer == true){      if(layer.nullLayer == true){        return "NULL";      }else if(layer.nullLayer == false){        return "SOLID";      }    }  }  AE2JSON.prototype.doCompLayers = function() {    var myComp, myLayer, numLayers, layerType;        myComp = this.comp;    if(myComp instanceof CompItem) {      numLayers = myComp.layers.length;            for(i=0; i<numLayers; i++) {        myLayer = myComp.layers[i+1];        if(!myLayer.adjustmentLayer == true){          layerType = this.checkLayerType(myLayer);          switch(layerType){            case "CAMERA":              this.defaultComp.layers.push(new Camera(this.defaultComp.compSettings, myLayer));              break;            case "LIGHT":              this.defaultComp.layers.push(new Light(this.defaultComp.compSettings, myLayer));              break;            case "NULL":              this.defaultComp.layers.push(new Null(this.defaultComp.compSettings, myLayer));              break;            case "SOLID":              this.defaultComp.layers.push(new Solid(this.defaultComp.compSettings, myLayer));              break;            case "FOOTAGE":              this.defaultComp.layers.push(new BaseObject(this.defaultComp.compSettings, myLayer));              break;          }        }      }    }  }  AE2JSON.prototype.renderJSON = function() {    var projectName, compName, filename, jsonExportFile, jsonString;    // create JSON file.    projectName = app.project.file.name.replace(".aep", '');    compName    = this.comp.name;    fileName    = projectName + "_"+ compName + ".json";    fileName    = fileName.replace(/\s/g, '');    var path = app.project.file.parent.absoluteURI + "/";    var fullPath = path + fileName;    jsonString = JSON.stringify(this.jsonData, null, "\t");    //    delete this.jsonData;    //jsonString = JSON.stringify(this.jsonData);    jsonExportFile = new File(fullPath);    jsonExportFile.open("w");    jsonExportFile.write(jsonString);    jsonExportFile.close();  }  function CompSettings(compObj){    this.name          = compObj.name;    this.width         = compObj.width;    this.height        = compObj.height;    this.frameRate     = compObj.frameRate;    this.frameDuration = compObj.frameDuration;    this.duration      = compObj.duration;    return this;  }  function BaseObject(compSettings, layer){    // Do not store layer, it's too big and can cause a stack overflow    this.objData = {};    this.beforeDefaults(compSettings, layer);    this.setDefaults(compSettings, layer);  }  BaseObject.prototype.beforeDefaults = function(compSettings, layer){    return true;  }  BaseObject.prototype.setDefaults = function(compSettings, layer){    // add _L + the layer index to make sure names are unique    this.objData.name  = this.createName(layer.name, layer.index);    this.objData.index = layer.index;    this.compSettings  = compSettings;    this.setPropGroups();    this.doProps(layer);   }  BaseObject.prototype.createName = function(name, index){    return name + "_L" + index;  }  BaseObject.prototype.setPropGroups = function(){    this.propGroups = ["transform"];  }  BaseObject.prototype.doProps = function(layer){    var i, j, hasParent, parentLayer, numPropGroups, propGroup, groupName, group, propName, prop, visible;    numPropGroups = this.propGroups.length;    hasParent = false;    if(layer.parent != null){      hasParent = true;      parentLayer = layer.parent;      this.objData.parent = this.createName(parentLayer.name, parentLayer.index);      layer.parent = null;    }else{      this.objData.parent = 0;    }    for(i=0; i<numPropGroups; i++){      groupName = this.propGroups[i];      group     = this.objData[groupName] = {};      propGroup = layer[groupName];      for (j = 1; j < propGroup.numProperties; j++){        visible = true;        try{          propGroup.property(j).selected = true;        }catch (err){          visible = false;        }        if (visible) {          propName = propGroup.property(j).name;          propName = propName.toCamelCase();          prop = propGroup.property(j);          group[propName] = this.setPropValues(prop);        }      }    }    if(hasParent){layer.parent = parentLayer};  }  BaseObject.prototype.setPropValues = function(prop){    var frameRate, duration, timeValues, firstKey, firstKeyTime,         lastKey, lastKeyTime, time, startFrame, endFrame, frame, propVal, times, props;    timeValues = new Array();    if(prop.numKeys > 1){        duration      = this.compSettings.duration;        frameDuration = this.compSettings.frameDuration;        frameRate     = this.compSettings.frameRate;        firstKey      = prop.nearestKeyIndex(0);        firstKeyTime  = prop.keyTime(firstKey);        lastKey       = prop.nearestKeyIndex(duration);        lastKeyTime   = prop.keyTime(lastKey);        startFrame = Number(timeToCurrentFormat(firstKeyTime, frameRate));        endFrame   = Number(timeToCurrentFormat(lastKeyTime, frameRate));        for(frame = startFrame; frame <= endFrame; frame++){          time = frame * frameDuration;          propVal = prop.valueAtTime(time, false);          timeValues.push([time, propVal]);        }    }else{      propVal = prop.value;      timeValues.push([0, propVal]);    }        return timeValues;  }    Null.prototype = Object.create(BaseObject.prototype);  function Null(compSettings, layer){    BaseObject.call(this, compSettings, layer);    return this.objData;  }  Null.prototype.beforeDefaults = function(compSettings, layer){    this.objData.layerType = "Null";  }    Solid.prototype = Object.create(BaseObject.prototype);  function Solid(compSettings, layer){    BaseObject.call(this, compSettings, layer);    return this.objData;  }  Solid.prototype.beforeDefaults = function(compSettings, layer){    this.objData.layerType = "Solid";  }  Camera.prototype = Object.create(BaseObject.prototype);  function Camera(compSettings, layer){    BaseObject.call(this, compSettings, layer);    return this.objData;  }  Camera.prototype.beforeDefaults = function(compSettings, layer){    this.objData.layerType = "Camera";  }  Camera.prototype.setPropGroups = function(){    this.propGroups = ['transform', 'cameraOption'];  }  Light.prototype = Object.create(BaseObject.prototype);  function Light(compSettings, layer){        BaseObject.call(this, compSettings, layer);    return this.objData;  }  Light.prototype.beforeDefaults = function(compSettings, layer){    this.objData.layerType = "Light";    this.lightType = layer.lightType;    this.setLightType();  }  Light.prototype.setPropGroups = function(){        this.propGroups = ['transform', 'lightOption'];  }  Light.prototype.setLightType = function(){    switch(this.lightType){      case LightType.POINT:        this.objData.lightType = "POINT";        break;      case LightType.SPOT:        this.objData.lightType = "SPOT";        break;      case LightType.PARALLEL:        this.objData.lightType = "PARALLEL";        break;      case LightType.AMBIENT:        this.objData.lightType = "AMBIENT";        break;    }  }  new AE2JSON(this);}