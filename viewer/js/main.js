var renderer, scene, camera, stats, controls, root;
var cloudMaterial;


function main() {
  if(!Detector.webgl) {
    Detector.addGetWebGLMessage();
  }
  initScene();

  if(window.location.hash) {
    loadUrl(window.location.hash.slice(1));
  }

  window.onhashchange = function() {
    loadUrl(window.location.hash.slice(1));
  }

  document.addEventListener("keydown", onKeyDown, false);
}


function initScene() {
  container = document.getElementById( 'container' );
  scene = new THREE.Scene();

  var near = 0.1;
  var far = 50000;
  scene.fog = new THREE.Fog(0x000000, near, far);

  camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, near, far );
  camera.position.z = 150;

  controls = new THREE.TrackballControls(camera);
  controls.rotateSpeed = 1.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.noZoom = false;
  controls.noPan = false;
  controls.staticMoving = true;
  controls.dynamicDampingFactor = 0.3;
  controls.keys = [ 65, 83, 68 ];
  controls.addEventListener('change', render);

  var axisHelper = new THREE.AxisHelper(5);
  scene.add(axisHelper);

  root = new THREE.Object3D();
  scene.add(root);

  renderer = new THREE.WebGLRenderer({antialias: false});
  renderer.setClearColor(scene.fog.color, 1);
  renderer.setSize( window.innerWidth, window.innerHeight );

  container.appendChild( renderer.domElement );

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  container.appendChild( stats.domElement );
  animate();
}


function clearRoot() {
  while (root.children.length > 0) {
    var object = root.children[0];
    object.parent.remove(object);
  }
}


function animate() {
  requestAnimationFrame(animate);
  controls.update();
}


function render() {
  renderer.render(scene, camera);
  stats.update();
}


function loadUrl(url) {
  function addToScene(object) {
    root.add(object);
    render();
  }

  if (url.endsWith(".mhd")) {
    loadMetaIO(url).then(addToScene)
  }
  else {
    console.warn('unknown extension: '+ url);
  }
}


function getFile(url, responseType) {
  console.log('loading: ' + url);

  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status == 200) {
        // Resolve the promise with the response text
        resolve(req.response);
      }
      else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(Error(req.statusText));
      }
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    };

    // Make the request
    req.send();
  });
}


function loadMetaIO(urlMhd) {
  return getFile(urlMhd, 'text').then(function(data) {
    var lines = data.split('\n').map(function (line) {
      return line.split('=').map(String.trim);
    });

    var mhd = {};
    lines.forEach(function (pair) {

      var NUMERICAL_KEYS = [
        'CenterOfRotation', 'DimSize', 'NDims', 'ElementSpacing',
        'Offset', 'TransformMatrix'
      ];

      if (NUMERICAL_KEYS.indexOf(pair[0]) >= 0) {
        mhd[pair[0]] = pair[1].split(' ').map(Number);
      }
      else {
        mhd[pair[0]] = pair[1];
      }
    });

    var urlRaw = (urlMhd.substring(0, urlMhd.lastIndexOf("/") + 1) +
    mhd['ElementDataFile']);

    return getFile(urlRaw, 'arraybuffer').then(buildRaw(mhd, 1000, 0.01, 0))
  });
}


function buildRaw(mhd, downsampleStep, scaleFactor, filterMin) {
  return function (data) {
    var METAIO_TYPE_MAP = {
      'MET_UCHAR': Uint8Array,
      'MET_UINT': Uint32Array,
      'MET_FLOAT': Float32Array,
    };

    var data = new METAIO_TYPE_MAP[mhd['ElementType']](data)

    var dimsizeX = mhd['DimSize'][0];
    var dimsizeY = mhd['DimSize'][1];
    var dimsizeZ = mhd['DimSize'][2];

    var geometry = new THREE.Geometry();
    var maxValue = _.max(data);
    var minValue = Math.max(filterMin, _.min(data));
    var count = 0;

    var getValue = function (x, y, z){
      // Fortran order
      var val = data[z * (dimsizeX * dimsizeY) + y * dimsizeX + x];
      return val;
    };

    var scale = new THREE.Vector3(
      mhd['ElementSpacing'][0] * scaleFactor,
      mhd['ElementSpacing'][1] * scaleFactor,
      mhd['ElementSpacing'][2] * scaleFactor
    );

    var i = 0;
    for (var z = 0; z < dimsizeZ; z++) {
      for (var y = 0; y < dimsizeY; y++) {
        for (var x = 0; x < dimsizeX; ++x) {
          i++;
          if ((i % downsampleStep) == 0) {

            var value = getValue(x, y, z);
            if (value > filterMin) {

              geometry.vertices.push(
                new THREE.Vector3(x, y, z).multiply(scale)
              );

              var intensity = (value - minValue) / (maxValue - minValue);
              geometry.colors.push(
                new THREE.Color(intensity, 0, 1 - intensity)
              );

              count++;
            }
          }
        }
      }
    }

    console.log('max: ' + maxValue + ' min: ' + minValue);
    console.log('loaded: ' + count + ' points');

    cloudMaterial = new THREE.PointCloudMaterial({
      size: 20 * (scale.x + scale.y + scale.z) / 3,
      vertexColors: THREE.VertexColors
    });
    return new THREE.PointCloud(geometry, cloudMaterial);
  };
}


function buildWireFrameCuboid(x, y, z) {
  var cuboid = new THREE.Object3D();
  var dims = new THREE.Vector3(x / 2, y / 2, z / 2);

  var material = new THREE.LineBasicMaterial({
    color: 0x000000
  });

  var geometry = new THREE.Geometry();
  geometry.vertices.push(new THREE.Vector3( dims.x,  dims.y,  dims.z));
  geometry.vertices.push(new THREE.Vector3(-dims.x,  dims.y,  dims.z));
  geometry.vertices.push(new THREE.Vector3(-dims.x, -dims.y,  dims.z));
  geometry.vertices.push(new THREE.Vector3( dims.x, -dims.y,  dims.z));
  geometry.vertices.push(new THREE.Vector3( dims.x,  dims.y,  dims.z));

  geometry.vertices.push(new THREE.Vector3( dims.x,  dims.y, -dims.z));
  geometry.vertices.push(new THREE.Vector3(-dims.x,  dims.y, -dims.z));
  geometry.vertices.push(new THREE.Vector3(-dims.x, -dims.y, -dims.z));
  geometry.vertices.push(new THREE.Vector3( dims.x, -dims.y, -dims.z));
  geometry.vertices.push(new THREE.Vector3( dims.x,  dims.y, -dims.z));
  var line = new THREE.Line(geometry, material);
  cuboid.add(line);

  var geometry = new THREE.Geometry();
  geometry.vertices.push(new THREE.Vector3(-dims.x,  dims.y,  dims.z));
  geometry.vertices.push(new THREE.Vector3(-dims.x,  dims.y, -dims.z));
  geometry.vertices.push(new THREE.Vector3(-dims.x, -dims.y,  dims.z));
  geometry.vertices.push(new THREE.Vector3(-dims.x, -dims.y, -dims.z));
  geometry.vertices.push(new THREE.Vector3( dims.x, -dims.y,  dims.z));
  geometry.vertices.push(new THREE.Vector3( dims.x, -dims.y, -dims.z));
  var line = new THREE.Line(geometry, material, THREE.LinePieces);
  cuboid.add(line);
  return cuboid;
}


function onKeyDown(evt) {
  // Increase/decrease point size
  if (evt.keyCode == 56 || evt.keyCode == 109) {
    cloudMaterial.size *= 0.9;
    console.log('cloudMaterial size', cloudMaterial.size);
    render();
  }
  if (evt.keyCode == 57 || evt.keyCode == 107) {
    cloudMaterial.size *= 1.1;
    console.log('cloudMaterial size', cloudMaterial.size);
    render();
  }
}
