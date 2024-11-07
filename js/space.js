var canvas = document.querySelector('canvas');
var ctx = canvas.getContext('2d');
var PI2 = Math.PI * 2;

var w = canvas.width = window.innerWidth;
var h = canvas.height = window.innerHeight;
canvas.style.width = w + 'px';
canvas.style.height = h + 'px';
ctx.lineWidth = 1.5;
ctx.strokeStyle = 'white';

var layers = [];
function Star(layerIndex) {
  this.layerIndex = layerIndex;
  this.origLayerIndex = this.layerIndex;
  this.x = Math.random() * (w + 200) - 100;
  this.y = Math.random() * (h + 200) - 100;
  this.origX = this.x;
  this.origY = this.y;
}

Star.prototype.draw = function() {
  ctx.beginPath();
  ctx.arc(this.x, this.y, this.layerIndex, 0, PI2);
  ctx.stroke();
}

Star.prototype.move = function(x, y) {
  this.x = this.origX + x * (0.01 + this.layerIndex / 50);
  this.y = this.origY + y * (0.01 + this.layerIndex / 50);
}

function Cloud() {
  this.x = w / 2;
  this.y = h / 2;
  this.origX = this.x;
  this.origY = this.y;
  this.cloudSize = 120;
}

Cloud.prototype.draw = function() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Light white color for the cloud
  
  // Draw the cloud using overlapping circles
  this.drawCloudPart(this.x - 70, this.y - 30, this.cloudSize);
  this.drawCloudPart(this.x - 30, this.y - 40, this.cloudSize);
  this.drawCloudPart(this.x + 20, this.y - 30, this.cloudSize);
  this.drawCloudPart(this.x + 50, this.y, this.cloudSize);
  this.drawCloudPart(this.x, this.y + 30, this.cloudSize);
  this.drawCloudPart(this.x - 40, this.y + 20, this.cloudSize);

  ctx.stroke();
}

Cloud.prototype.drawCloudPart = function(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size, 0, PI2);
  ctx.fill();
}

Cloud.prototype.think = function(x, y) {
  this.x = this.origX + x / 30;
  this.y = this.origY + y / 30;
}

function StarsLayer(index) {
  this.stars = [];
  for (var i = 0; i < 400 / (index*2); i++) {
    this.stars.push(new Star(index));
  }
}

StarsLayer.prototype.draw = function() {
  for (var i = 0; i < this.stars.length; i++) {
    this.stars[i].draw();
  }
}

StarsLayer.prototype.move = function(x, y) {  
  for (var i = 0; i < this.stars.length; i++) {
    this.stars[i].move(x, y);
  }
}

StarsLayer.prototype.each = function(cb) {
  for (var i = 0; i < this.stars.length; i++) {
    cb(this.stars[i], i, this.stars);
  }
}

var s1 = new StarsLayer(1);
var s2 = new StarsLayer(2);
var s3 = new StarsLayer(3);
var cloud = new Cloud();

(function loop() {
  ctx.clearRect(0, 0, w, h);
  s1.draw();
  s2.draw();
  cloud.draw();
  s3.draw();
  requestAnimationFrame(loop);
})()

canvas.addEventListener('mousemove', function(e) {
  var x = e.layerX - w / 2;
  var y = e.layerY - h / 2;
  s1.move(x, y);
  s2.move(x, y);
  s3.move(x, y);
  cloud.think(x, y);
});

