/*
EXTRA CREDIT:
- added a function to load each sphere subdivision into memory at the start of the program to reduce lag
- added an "info panel" to display some status information in the browser incuding an fps counter
*/

var canvas;
var gl;

var numTimesToSubdivide = 4;
var chankinSubDivisions = 0;

var lightingMode = 2; // 0 is wireframe, 1 is gouraud, 2 is phong
var lightingModeStrings = ["wireframe", "gouraud", "phong"];
var prevMode = 1;
var index = 0;

var alpha = 0;

var animation = false;
var animationSpeed = 0.05;

var localPointsArray = [];
var loadedSubs = [];
var pointsArray = [];
var chankinPath = [];
var normalsArray = [];
var gouraudNormals = [];

var modelPos = [0, 0, 0];
var chankinPos = 0;

var program;

const va = vec4(0.0, 0.0, -1.0, 1);
const vb = vec4(0.0, 0.942809, 0.333333, 1);
const vc = vec4(-0.816497, -0.471405, 0.333333, 1);
const vd = vec4(0.816497, -0.471405, 0.333333, 1);

var frameTime = 0;
var frames = 0;
var prevTime = 0;

var lightPosition = vec4(0.0, 0.0, -10.0, 0.0);
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

var projectionMatrix;
var modelMatrix;
var projectionMatrixLoc;
var lightingModeLoc;
var modelMatrixLoc;

var vBuffer;
var chankinBuffer;
var vPosition;
var vNormal;
var vNormalPosition;
var vNormalG;
var vNormalGPosition;

var eye = vec3(0, 0.0, 0);
var at = vec3(0.0, 0.0, -1);
var up = vec3(0.0, 1.0, 0.0);

var prevTime = new Date().getTime();

//creates and stores a triangle - calculates normals using newells method
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

//calculates the normal of a triangle using newell's method
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

//perform chankin subdivision on a set of control points
//uses 1/4 and 3/4 mixings for the new points
function chankinSubDivide(pts, n) {
  if (n > 0) {
    let newPts = [];
    for (let i = 0; i < pts.length; i++) {
      //calculate the new points using the 1/4 and 3/4 mixings
      let p1 = mix(pts[i], pts[(i + 1) % pts.length], 0.25);
      let p2 = mix(pts[i], pts[(i + 1) % pts.length], 0.75);
      newPts.push(p1);
      newPts.push(p2);
    }
    return chankinSubDivide(newPts, n - 1); //recursive call
  } else {
    return pts;
  }
}

//creates a vector from an array of points - used for the chankin path
function controlToVector(chankinControls) {
  resArray = [];
  for (let i = 0; i < chankinControls.length; i++) {
    resArray.push(vec4(chankinControls[i][0], chankinControls[i][1], -12, 1));
  }
  return resArray;
}

//performs subdivision on a triangle recursively
//is from the sample code provided in lecture
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

//recursivley divides triangles in a tetrahedron
function tetrahedron(a, b, c, d, n) {
  divideTriangle(a, b, c, n);
  divideTriangle(d, c, b, n);
  divideTriangle(a, d, b, n);
  divideTriangle(a, c, d, n);
}

//creates all of the buffers needed
function makeBuffers() {
  vBuffer = gl.createBuffer();
  chankinBuffer = gl.createBuffer();
  vPosition = gl.getAttribLocation(program, "vPosition");
  vNormal = gl.createBuffer();
  vNormalPosition = gl.getAttribLocation(program, "vNormal");
  vNormalG = gl.createBuffer();
  vNormalGPosition = gl.getAttribLocation(program, "vNormalG");
}

//updates the models points, normals, ect. and position matrix
function updateModel(pos = modelPos) {
  //uses the preloaded subdivisions to update the model
  localPointsArray = loadedSubs[numTimesToSubdivide - 1]["points"];
  normalsArray = loadedSubs[numTimesToSubdivide - 1]["normals"];
  gouraudNormals = loadedSubs[numTimesToSubdivide - 1]["gnormals"];
  index = loadedSubs[numTimesToSubdivide - 1]["index"];
  setModelPos(pos);
  document.getElementById("modelSubs").innerHTML =
    "Model Subdivisions: " + numTimesToSubdivide;
}

//preloads the models subdivisions
function preloadSubdivisions() {
  for (let i = 1; i <= 8; i++) {
    localPointsArray = [];
    normalsArray = [];
    gouraudNormals = [];
    index = 0;
    tetrahedron(va, vb, vc, vd, i);
    loadedSubs.push({
      points: localPointsArray,
      normals: normalsArray,
      gnormals: gouraudNormals,
      index: index,
    });
  }
}

//updates the model's buffers
function bufferModel() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(localPointsArray), gl.STATIC_DRAW);

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

//updates the chankin path after a change in the number of subdivisions
function updateChankin(increaseSubs, init = false) {
  chankinPath = [];
  let chankinVecs = controlToVector(chankinControls);
  chankinPath = chankinSubDivide(chankinVecs, chankinSubDivisions);
  if (!init) {
    //will reposition the models position if the chankin path is changed
    //uses 2x the current position because chankin subdivisions increase the number of points by a factor of 2
    if (increaseSubs) {
      //multiply by 2
      chankinPos = Math.floor(chankinPos * 2) % chankinPath.length;
    } else {
      //divide by 2 and round down
      chankinPos = Math.floor(chankinPos / 2) % chankinPath.length;
    }
  }
  //sets the models position to a point on the chankin path
  setModelPos(chankinPath[chankinPos]);
  document.getElementById("pathSubs").innerHTML =
    "Path Subdivisions: " + chankinSubDivisions;
}

//updates the chankin buffers
function bufferChankin() {
  gl.bindBuffer(gl.ARRAY_BUFFER, chankinBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(chankinPath), gl.STATIC_DRAW);
}

//when the window is loaded
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

  preloadSubdivisions();

  updateChankin(false, true);
  bufferChankin();
  setModelPos(chankinPath[chankinPos]);
  bufferModel();

  projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
  modelMatrixLoc = gl.getUniformLocation(program, "modelMatrix");
  lightingModeLoc = gl.getUniformLocation(program, "lightingType");

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
  gl.uniform1f(lightingModeLoc, lightingMode);

  // perspecive projection matrix with fov of 90 degrees, aspect ratio of 1, near plane of 0.1, and far plane of 100
  projectionMatrix = perspective(90, 1, 0.1, 100);
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  //initialize some info panel variables
  document.getElementById("animationStatus").innerHTML =
    "Animation: " + animation;

  document.getElementById("modelSubs").innerHTML =
    "Model Subdivisions: " + numTimesToSubdivide;

  setLightingMode(lightingMode);

  render();
};

// key event listener
window.addEventListener("keydown", function (event) {
  switch (event.key) {
    case "m": //toggle wireframe
      if (lightingMode == 0) {
        lightingMode = prevMode;
      } else {
        prevMode = lightingMode;
        lightingMode = 0;
      }
      console.log("lighting mode: " + lightingModeStrings[lightingMode]);
      setLightingMode(lightingMode);

      break;
    case "l": //toggle lighting mode
      if (lightingMode == 1) {
        lightingMode = 2;
      } else if (lightingMode == 2) {
        lightingMode = 1;
      }
      console.log("lighting mode: " + lightingModeStrings[lightingMode]);
      setLightingMode(lightingMode);
      break;
    case "q": //decrease model subdivisions
      if (numTimesToSubdivide > 1) {
        numTimesToSubdivide--;
        updateModel();
        bufferModel();
        console.log("subdivisions: " + numTimesToSubdivide);
      }
      break;
    case "e": //increase model subdivisions
      if (numTimesToSubdivide < 8) {
        numTimesToSubdivide++;
        updateModel();
        bufferModel();
        console.log("subdivisions: " + numTimesToSubdivide);
      }
      break;
    case "i": //increase path subdivisions
      if (chankinSubDivisions < 8) {
        chankinSubDivisions++;
        updateChankin(true);
        bufferChankin();
        console.log("subdivisions: " + chankinSubDivisions);
      }
      break;
    case "j": //decrease path subdivisions
      if (chankinSubDivisions > 0) {
        chankinSubDivisions--;
        updateChankin(false);
        bufferChankin();
        console.log("subdivisions: " + chankinSubDivisions);
      }
      break;
    case "a": //toggle animation
      animation = !animation;
      console.log("animation: " + animation);
      document.getElementById("animationStatus").innerHTML =
        "Animation: " + animation;
      break;
  }
});

function calculateFPS() {
  var now = new Date().getTime();

  frameTime = frameTime + now - prevTime;

  prevTime = now;

  frames++;
  //if 1 second has passed set the FPS to the current frame count
  if (frameTime / 1000 > 1) {
    fps = frames;
    frames = 0;
    frameTime = 0;
    document.getElementById("fpsCounter").innerHTML = "FPS: " + fps;
  }
}

function render() {
  //calculate FPS and display it
  calculateFPS();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //draw the path
  drawChankin();

  //draw the model
  drawModel();

  //if we are animating, perform the animation
  if (animation) {
    animate();
  }

  //call the render function again
  requestAnimFrame(render);
}

//animates the model along the path
function animate() {
  //get the next position in the chankin path to determine the direction of travel
  let nextPos = (chankinPos + 1) % chankinPath.length;
  //get the vector between the current position and the next position
  let dir = subtract(chankinPath[nextPos], chankinPath[chankinPos]);
  //get the direction between the current model position and the next position
  let modelDir = subtract(chankinPath[nextPos], modelPos);
  //if dir and modelDir are in opposite directions, then we have reached the end of this path
  if (dot(dir, modelDir) < 0) {
    //set the model position to the next position in the chankin path
    chankinPos++;
    chankinPos %= chankinPath.length;
    setModelPos(chankinPath[chankinPos]);
    nextPos = (chankinPos + 1) % chankinPath.length;
    dir = subtract(chankinPath[nextPos], chankinPath[chankinPos]);
  }
  //get a unit vector in the direction of travel
  dir = normalize(dir);
  //multiply the direction by the speed to get the velocity
  dir = scale(animationSpeed, dir);
  setModelPos(add(modelPos, dir));
}

//draws the model
function drawModel() {
  gl.uniformMatrix4fv(modelMatrixLoc, false, flatten(modelMatrix));
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);
  if (lightingMode == 0) {
    gl.drawArrays(gl.LINE_STRIP, 0, index);
  } else {
    gl.drawArrays(gl.TRIANGLES, 0, index);
  }
}

//draws the chankin path
function drawChankin() {
  gl.uniformMatrix4fv(modelMatrixLoc, false, flatten(mat4()));
  gl.uniform1f(lightingModeLoc, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, chankinBuffer);
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);
  gl.drawArrays(gl.LINE_LOOP, 0, chankinPath.length);
  gl.uniform1f(lightingModeLoc, lightingMode);
}

//sets the lighting mode
function setLightingMode(mode) {
  gl.uniform1f(lightingModeLoc, mode);
  document.getElementById("lightingType").innerHTML =
    "Lighting Style: " + lightingModeStrings[mode];
}

//sets the model position and matrix
function setModelPos(pos) {
  modelPos = pos;
  modelMatrix = translate(modelPos[0], modelPos[1], modelPos[2]);
}
