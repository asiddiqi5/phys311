// Find the canvas and get its drawing tool ("context")
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

// --- A filled rectangle ---
ctx.fillStyle = "#ff8200";          // UT orange
ctx.fillRect(50, 50, 120, 80);      // x, y, width, height

// --- An outlined rectangle ---
ctx.strokeStyle = "#2d6ca2";        // blue
ctx.lineWidth = 4;
ctx.strokeRect(220, 50, 120, 80);

// --- A filled circle ---
ctx.fillStyle = "#2e8b4f";          // green
ctx.beginPath();
ctx.arc(450, 90, 45, 0, 2 * Math.PI);   // x, y, radius, start, end
ctx.fill();

// --- A straight line ---
ctx.strokeStyle = "black";
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(50, 200);                // start point
ctx.lineTo(550, 200);               // end point
ctx.stroke();

// --- Some text ---
ctx.fillStyle = "black";
ctx.font = "20px sans-serif";
ctx.fillText("Physics 311 - it works!", 50, 250);

console.log("main.js ran successfully");

// ---- Simple animation: a bouncing ball ----
let x = 300, y = 320;      // position
let vx = 180, vy = -120;   // velocity in pixels per second
const r = 15;

let lastTime = performance.now();

function frame(now) {
  const dt = (now - lastTime) / 1000;   // seconds since last frame
  lastTime = now;

  // Move
  x += vx * dt;
  y += vy * dt;

  // Bounce off the walls
  if (x - r < 0 || x + r > canvas.width)  vx = -vx;
  if (y - r < 0 || y + r > canvas.height) vy = -vy;

  // Erase and redraw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff8200";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();

  requestAnimationFrame(frame);   // ask for the next frame
}

requestAnimationFrame(frame);