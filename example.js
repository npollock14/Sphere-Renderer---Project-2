var canvas;
var gl;

var numTimesToSubdivide = 5;
var chankinSubDivisions = 0;

var lightingMode = 0; // 0 is wireframe, 1 is gouraud, 2 is phong
var lightingModeStrings = ["wireframe", "gouraud", "phong"];
var prevMode = 1;
var index = 0;

var alpha = 0;

var animation = false;
var animationSpeed = 0.05;

var localPointsArray = [];
var pointsArray = [];
var chankinPath = [];
var normalsArray = [];
var gouraudNormals = [];

var modelPos;
var chankinPos = 4;

var program;

const va = vec4(0.0, 0.0, -1.0, 1);
const vb = vec4(0.0, 0.942809, 0.333333, 1);
const vc = vec4(-0.816497, -0.471405, 0.333333, 1);
const vd = vec4(0.816497, -0.471405, 0.333333, 1);

var lightPosition = vec4(1.0, 1.0, 1.0, 0.0);
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

const materialAmbient = vec4(1.0, 0.0, 1.0, 1.0);
const materialDiffuse = vec4(1.0, 0.8, 0.0, 1.0);
const materialSpecular = vec4(1.0, 1.0, 1.0, 1.0);
const materialShininess = 20.0;

const chankinControls = [
  [-8.0, 8.0],
  [2.0, 4.0],
  [6.0, 6.0],
  [10, -8.0],
  [2.0, -2.0],
  [-6.0, -2.0],
];

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

var vBuffer;
var chankinBuffer;
var vPosition;
var vNormal;
var vNormalPosition;
var vNormalG;
var vNormalGPosition;

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 0.0, 0.0);

function triangle(a, b, c) {
  localPointsArray.push(a);
  localPointsArray.push(b);
  localPointsArray.push(c);

  //calculate a normal using newell's method and add it to the gouraudNormals array
  //we use the single normal for all three vertices as required by the assignment
  let normal = getNewellNormal([a, b, c, a]);
  gouraudNormals.push(normal);
  gouraudNormals.push(normal);
  gouraudNormals.push(normal);

  normalsArray.push(a[0], a[1], a[2], 0.0);
  normalsArray.push(b[0], b[1], b[2], 0.0);
  normalsArray.push(c[0], c[1], c[2], 0.0);

  index += 3;
}

function getNewellNormal(pts) {
  let normal = vec4(0.0, 0.0, 0.0, 0.0);
  for (let i = 0; i < 3; i++) {
    normal[0] += (pts[i][1] - pts[i + 1][1]) * (pts[i][2] + pts[i + 1][2]);
  }
  for (let i = 0; i < 3; i++) {
    normal[1] += (pts[i][2] - pts[i + 1][2]) * (pts[i][0] + pts[i + 1][0]);
  }
  for (let i = 0; i < 3; i++) {
    normal[2] += (pts[i][0] - pts[i + 1][0]) * (pts[i][1] + pts[i + 1][1]);
  }

  return vec4(-normal[0], -normal[1], -normal[2], 0.0);
}

//perform chankin subdivision on a set of controll points
// use 1/4 and 3/4 mixings for the new points
function chankinSubDivide(pts, n) {
  if (n > 0) {
    let newPts = [];
    for (let i = 0; i < pts.length; i++) {
      let p1 = mix(pts[i], pts[(i + 1) % pts.length], 0.25);
      let p2 = mix(pts[i], pts[(i + 1) % pts.length], 0.75);
      newPts.push(p1);
      newPts.push(p2);
    }
    return chankinSubDivide(newPts, n - 1);
  } else {
    return pts;
  }
}

function controlToVector(chankinControls) {
  resArray = [];
  for (let i = 0; i < chankinControls.length; i++) {
    resArray.push(vec4(chankinControls[i][0], chankinControls[i][1], -10.0, 1));
  }
  return resArray;
}

function divideTriangle(a, b, c, count) {
  if (count > 0) {
    var ab = mix(a, b, 0.5);
    var ac = mix(a, c, 0.5);
    var bc = mix(b, c, 0.5);

    ab = normalize(ab, true);
    ac = normalize(ac, true);
    bc = normalize(bc, true);

    divideTriangle(a, ab, ac, count - 1);
    divideTriangle(ab, b, bc, count - 1);
    divideTriangle(bc, c, ac, count - 1);
    divideTriangle(ab, bc, ac, count - 1);
  } else {
    triangle(a, b, c);
  }
}

function tetrahedron(a, b, c, d, n) {
  divideTriangle(a, b, c, n);
  divideTriangle(d, c, b, n);
  divideTriangle(a, d, b, n);
  divideTriangle(a, c, d, n);
}

function makeBuffers() {
  vBuffer = gl.createBuffer();
  chankinBuffer = gl.createBuffer();
  vPosition = gl.getAttribLocation(program, "vPosition");
  vNormal = gl.createBuffer();
  vNormalPosition = gl.getAttribLocation(program, "vNormal");
  vNormalG = gl.createBuffer();
  vNormalGPosition = gl.getAttribLocation(program, "vNormalG");
}

function updateModel(pos = modelPos) {
  localPointsArray = [];
  normalsArray = [];
  gouraudNormals = [];
  index = 0;
  tetrahedron(va, vb, vc, vd, numTimesToSubdivide);
  setModelPos(pos);
}

function bufferModel() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, vNormal);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);

  gl.vertexAttribPointer(vNormalPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vNormalPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, vNormalG);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(gouraudNormals), gl.STATIC_DRAW);

  gl.vertexAttribPointer(vNormalGPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vNormalGPosition);
}

function updateChankin(increaseSubs, init = false) {
  chankinPath = [];
  let chankinVecs = controlToVector(chankinControls);
  chankinPath = chankinSubDivide(chankinVecs, chankinSubDivisions);
  if (!init) {
    if (increaseSubs) {
      chankinPos = (chankinPos * 2) % chankinPath.length;
    } else {
      //divide by 2 and round down
      chankinPos = Math.floor(chankinPos / 2) % chankinPath.length;
    }
  }
  setModelPos(chankinPath[chankinPos]);
}

function bufferChankin() {
  gl.bindBuffer(gl.ARRAY_BUFFER, chankinBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(chankinPath), gl.STATIC_DRAW);
}

window.onload = function init() {
  canvas = document.getElementById("gl-canvas");

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL isn't available");
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  gl.enable(gl.DEPTH_TEST);

  //
  //  Load shaders and initialize attribute buffers
  //
  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  makeBuffers();

  var diffuseProduct = mult(lightDiffuse, materialDiffuse);
  var specularProduct = mult(lightSpecular, materialSpecular);
  var ambientProduct = mult(lightAmbient, materialAmbient);

  updateChankin(false, true);
  bufferChankin();
  updateModel(chankinPath[chankinPos]);
  bufferModel();

  modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
  projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

  gl.uniform4fv(
    gl.getUniformLocation(program, "diffuseProduct"),
    flatten(diffuseProduct)
  );
  gl.uniform4fv(
    gl.getUniformLocation(program, "specularProduct"),
    flatten(specularProduct)
  );
  gl.uniform4fv(
    gl.getUniformLocation(program, "ambientProduct"),
    flatten(ambientProduct)
  );
  gl.uniform4fv(
    gl.getUniformLocation(program, "lightPosition"),
    flatten(lightPosition)
  );
  gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);
  gl.uniform1f(gl.getUniformLocation(program, "lightingType"), lightingMode);

  render();
};

// add key down event listener
window.addEventListener("keydown", function (event) {
  switch (event.key) {
    case "m":
      if (lightingMode == 0) {
        lightingMode = prevMode;
      } else {
        prevMode = lightingMode;
        lightingMode = 0;
      }
      console.log("lighting mode: " + lightingModeStrings[lightingMode]);
      setLightingMode(lightingMode);

      break;
    case "l":
      if (lightingMode == 1) {
        lightingMode = 2;
      } else if (lightingMode == 2) {
        lightingMode = 1;
      }
      console.log("lighting mode: " + lightingModeStrings[lightingMode]);
      setLightingMode(lightingMode);
      break;
    case "q": //decrease subdivisions
      if (numTimesToSubdivide > 0) {
        numTimesToSubdivide--;
        updateModel();
        bufferModel();
        console.log("subdivisions: " + numTimesToSubdivide);
      }
      break;
    case "e": //increase subdivisions
      if (numTimesToSubdivide < 8) {
        numTimesToSubdivide++;
        updateModel();
        bufferModel();
        console.log("subdivisions: " + numTimesToSubdivide);
      }
      break;
    case "i": //increase subdivisions
      if (chankinSubDivisions < 8) {
        chankinSubDivisions++;
        updateChankin(true);
        bufferChankin();
        bufferModel();
        // setModelPos(chankinPath[chankinPos]); // TODO: fix this
        console.log("subdivisions: " + chankinSubDivisions);
      }
      break;
    case "j": //decrease subdivisions
      if (chankinSubDivisions > 0) {
        chankinSubDivisions--;
        updateChankin(false);
        bufferChankin();
        bufferModel();
        console.log("subdivisions: " + chankinSubDivisions);
      }
      break;
    case "a": //toggle animation
      animation = !animation;
      console.log("animation: " + animation);
      break;
  }
});

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  eye = vec3(0, 0.0, 0);

  modelViewMatrix = translate(0.0, 0.0, -1.0);
  //alpha += 0.25;
  modelViewMatrix = mult(lookAt(eye, at, up), modelViewMatrix);
  // perspecive projection
  projectionMatrix = perspective(90, 1, 0.1, 100);

  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  drawChankin();

  drawModel();

  if (animation) {
    //get the next position in the chankin path to determine the direction of travel
    let nextPos = (chankinPos + 1) % chankinPath.length;
    //get the vector between the current position and the next position
    let dir = subtract(chankinPath[nextPos], chankinPath[chankinPos]);
    //get a unit vector in the direction of travel
    dir = normalize(dir);
    //multiply the direction by the speed to the velocity
    dir = scale(animationSpeed, dir);
    setModelPos(add(modelPos, dir));
    bufferModel();
  }

  requestAnimFrame(render);
}

function drawModel() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);
  if (lightingMode == 0) {
    for (var i = 0; i < index; i += 3) {
      gl.drawArrays(gl.LINE_STRIP, i, 3);
    }
  } else {
    for (var i = 0; i < index; i += 3) gl.drawArrays(gl.TRIANGLES, i, 3);
  }
}

function drawChankin() {
  setLightingMode(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, chankinBuffer);
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);
  gl.drawArrays(gl.LINE_LOOP, 0, chankinPath.length);
  setLightingMode(lightingMode);
}

function setLightingMode(mode) {
  gl.uniform1f(gl.getUniformLocation(program, "lightingType"), mode);
}

function setModelPos(pos) {
  modelPos = pos;
  pointsArray = [];
  let centerOffset = vec4(0, 0, 0, 0.0);
  //offset all points in point array by modelPos
  for (var i = 0; i < localPointsArray.length; i++) {
    pointsArray[i] = add(localPointsArray[i], modelPos);
    pointsArray[i] = add(pointsArray[i], centerOffset);
  }
}
