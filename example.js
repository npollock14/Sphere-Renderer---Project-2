var canvas;
var gl;

var numTimesToSubdivide = 5;

var lightingMode = 1; // 0 is wireframe, 1 is gouraud, 2 is phong
var lightingModeStrings = ["wireframe", "gouraud", "phong"];
var prevMode = 1;
var index = 0;

var alpha = 0;

var pointsArray = [];
var avgArray = [];
var normalsArray = [];
var gouraudNormals = [];

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

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

function triangle(a, b, c) {
  pointsArray.push(a);
  pointsArray.push(b);
  pointsArray.push(c);

  //push the average of the points to the avgArray
  avgArray.push(
    vec4(
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
      1.0
    )
  );

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

function updateModel() {
  pointsArray = [];
  avgArray = [];
  normalsArray = [];
  gouraudNormals = [];
  index = 0;

  tetrahedron(va, vb, vc, vd, numTimesToSubdivide);

  var vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

  var vPosition = gl.getAttribLocation(program, "vPosition");
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);

  var vAvgBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vAvgBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(avgArray), gl.STATIC_DRAW);

  var vAvgPosition = gl.getAttribLocation(program, "vAvg");
  gl.vertexAttribPointer(vAvgPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vAvgPosition);

  var vNormal = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vNormal);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);

  var vNormalPosition = gl.getAttribLocation(program, "vNormal");
  gl.vertexAttribPointer(vNormalPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vNormalPosition);

  var vNormalG = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vNormalG);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(gouraudNormals), gl.STATIC_DRAW);

  var vNormalGPosition = gl.getAttribLocation(program, "vNormalG");
  gl.vertexAttribPointer(vNormalGPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vNormalGPosition);
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

  var diffuseProduct = mult(lightDiffuse, materialDiffuse);
  var specularProduct = mult(lightSpecular, materialSpecular);
  var ambientProduct = mult(lightAmbient, materialAmbient);

  updateModel();

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
      gl.uniform1f(
        gl.getUniformLocation(program, "lightingType"),
        lightingMode
      );

      break;
    case "l":
      if (lightingMode == 1) {
        lightingMode = 2;
      } else if (lightingMode == 2) {
        lightingMode = 1;
      }
      console.log("lighting mode: " + lightingModeStrings[lightingMode]);
      gl.uniform1f(
        gl.getUniformLocation(program, "lightingType"),
        lightingMode
      );
      break;
    case "q": //decrease subdivisions
      if (numTimesToSubdivide > 0) {
        numTimesToSubdivide--;
        updateModel();
        console.log("subdivisions: " + numTimesToSubdivide);
      }
      break;
    case "e": //increase subdivisions
      if (numTimesToSubdivide < 8) {
        numTimesToSubdivide++;
        updateModel();
        console.log("subdivisions: " + numTimesToSubdivide);
      }
      break;
  }
});

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  eye = vec3(0, 0, 1.5);

  modelViewMatrix = translate(0.0, 0.0, -1.0);
  modelViewMatrix = mult(modelViewMatrix, rotateX(alpha));
  modelViewMatrix = mult(modelViewMatrix, rotateY(alpha));

  //alpha += 0.25;
  modelViewMatrix = mult(lookAt(eye, at, up), modelViewMatrix);
  // perspecive projection
  projectionMatrix = perspective(80, 1, 0.1, 10);

  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  if (lightingMode == 0) {
    for (var i = 0; i < index; i += 3) {
      gl.drawArrays(gl.LINE_STRIP, i, 3);
    }
  } else {
    for (var i = 0; i < index; i += 3) gl.drawArrays(gl.TRIANGLES, i, 3);
  }
  requestAnimFrame(render);
}
