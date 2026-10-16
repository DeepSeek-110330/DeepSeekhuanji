/* ============================================================
   代码绘图引擎 —— 用 Canvas 实时绘制数学图形
   支持类型：
     function  函数图像（可多条曲线）
     geometry  平面几何图形（点线面、三角形、圆等）
     unitcircle 单位圆与三角函数
     numberline 数轴
     custom    自定义绘制函数
   ============================================================ */

const PALETTE = ["#4cc9f0", "#ff6b9d", "#06d6a0", "#ffd166", "#b388ff", "#ff8f5e"];

/* ---------- 安全的表达式求值器 ----------
   支持 + - * / ^ 括号、常见函数、常量、变量 x 与参数 a,b,c...
   不使用 eval，避免安全与作用域问题。 */
function buildEvaluator(expr, params, varNames) {
  // 把 ^ 转成 **，并处理隐式乘法如 2x -> 2*x
  let s = expr.replace(/\^/g, "**");

  // 给每个幂运算的底数补括号：JS 里 `-x**2` 是语法错误（一元负号不能紧接 **），
  // 补成 `-(x**2)` 后既能编译、语义也不变。指数允许带负号。
  s = s.replace(
    /(\([^()]*\)|[A-Za-z_][\w.]*|\d+(?:\.\d+)?)\s*\*\*\s*(-?\s*(?:\([^()]*\)|[A-Za-z_][\w.]*|\d+(?:\.\d+)?))/g,
    "($1**$2)"
  );

  s = s
    .replace(/\bln\b/g, "log")
    .replace(/\bpi\b/gi, "PI")
    .replace(/\be\b(?!x)/g, "E");

  const allowed = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, log: Math.log, log2: Math.log2, log10: Math.log10,
    sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
    PI: Math.PI, E: Math.E, pow: Math.pow, sign: Math.sign,
    min: Math.min, max: Math.max, round: Math.round,
    hypot: Math.hypot,
    ...params,
  };

  const names = Object.keys(allowed);
  const values = names.map((n) => allowed[n]);
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...varNames,
      "params",
      ...names,
      `"use strict"; return (${s});`
    );
    return (...args) => {
      try {
        return fn(...args, params, ...values);
      } catch {
        return NaN;
      }
    };
  } catch {
    return () => NaN;
  }
}

function compileExpr(expr, params = {}) {
  return buildEvaluator(expr, params, ["x"]);
}

/** 二元函数求值器：f(x, y) */
function compileExpr2(expr, params = {}) {
  return buildEvaluator(expr, params, ["x", "y"]);
}

/* ---------- 主入口：把 plot 描述渲染到容器 ---------- */
export function renderPlot(plot, container) {
  const canvas = document.createElement("canvas");
  const width = container.clientWidth || 420;
  const height = plot.height || 260;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = "100%";
  canvas.style.height = height + "px";
  canvas.className = "plot-canvas";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(10, 14, 30, 0.5)";
    ctx.fillRect(0, 0, width, height);

    switch (plot.type) {
      case "function":
        drawFunctionPlot(ctx, plot, width, height);
        break;
      case "geometry":
        drawGeometry(ctx, plot, width, height);
        break;
      case "unitcircle":
        drawUnitCircle(ctx, plot, width, height);
        break;
      case "numberline":
        drawNumberLine(ctx, plot, width, height);
        break;
      case "contour":
        drawContour(ctx, plot, width, height);
        break;
      case "vectorfield":
        drawVectorField(ctx, plot, width, height);
        break;
      case "conformal":
        drawConformal(ctx, plot, width, height);
        break;
      case "slopefield":
        drawSlopeField(ctx, plot, width, height);
        break;
      case "scatter":
        drawScatter(ctx, plot, width, height);
        break;
      case "quadrature":
        drawQuadrature(ctx, plot, width, height);
        break;
      case "curve3d":
        drawCurve3D(ctx, plot, width, height);
        break;
      case "surface3d":
        drawSurface3D(ctx, plot, width, height);
        break;
      default:
        if (typeof plot.draw === "function") plot.draw(ctx, width, height);
    }

    if (plot.title) drawTitle(ctx, plot.title, width);
  };

  draw();
  return canvas;
}

function drawTitle(ctx, title, width) {
  ctx.fillStyle = "rgba(180, 195, 255, 0.85)";
  ctx.font = "12px -apple-system, 'PingFang SC', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 18);
}

/* ============================================================
   函数图像
   ============================================================ */
function drawFunctionPlot(ctx, plot, width, height) {
  const pad = { l: 38, r: 16, t: 34, b: 26 };
  const [x0, x1] = plot.xRange || [-5, 5];
  const [y0, y1] = plot.yRange || [-5, 5];

  const px = (x) => pad.l + ((x - x0) / (x1 - x0)) * (width - pad.l - pad.r);
  const py = (y) => height - pad.b - ((y - y0) / (y1 - y0)) * (height - pad.t - pad.b);

  // 网格
  ctx.strokeStyle = "rgba(120, 140, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(140, 155, 200, 0.7)";
  ctx.textAlign = "center";

  for (let x = Math.ceil(x0); x <= x1; x++) {
    if (x === 0) continue;
    ctx.beginPath();
    ctx.moveTo(px(x), pad.t);
    ctx.lineTo(px(x), height - pad.b);
    ctx.stroke();
    ctx.fillText(x, px(x), height - pad.b + 13);
  }
  ctx.textAlign = "right";
  for (let y = Math.ceil(y0); y <= y1; y++) {
    if (y === 0) continue;
    ctx.beginPath();
    ctx.moveTo(pad.l, py(y));
    ctx.lineTo(width - pad.r, py(y));
    ctx.stroke();
    ctx.fillText(y, pad.l - 6, py(y) + 3);
  }

  // 坐标轴
  const axisColor = "rgba(160, 175, 220, 0.8)";
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1.5;
  // x 轴
  if (y0 <= 0 && 0 <= y1) {
    ctx.beginPath();
    ctx.moveTo(pad.l, py(0));
    ctx.lineTo(width - pad.r, py(0));
    ctx.stroke();
  }
  // y 轴
  if (x0 <= 0 && 0 <= x1) {
    ctx.beginPath();
    ctx.moveTo(px(0), pad.t);
    ctx.lineTo(px(0), height - pad.b);
    ctx.stroke();
  }

  // 面积填充（定积分、概率密度等）
  (plot.fills || []).forEach((fill, idx) => {
    const fn = compileExpr(fill.expr, fill.params || {});
    const a = fill.from !== undefined ? fill.from : x0;
    const b = fill.to !== undefined ? fill.to : x1;
    const base = fill.base !== undefined ? fill.base : 0;
    const steps = 200;

    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= steps; i++) {
      const x = a + ((b - a) * i) / steps;
      const y = fn(x);
      if (!isFinite(y)) continue;
      const cx = px(x);
      const cy = py(y);
      if (!started) {
        ctx.moveTo(cx, cy);
        started = true;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.lineTo(px(b), py(base));
    ctx.lineTo(px(a), py(base));
    ctx.closePath();
    const c = fill.color || PALETTE[idx % PALETTE.length];
    ctx.fillStyle = fill.fill || hexToRgba(c, 0.22);
    ctx.fill();
    if (fill.stroke !== false) {
      ctx.strokeStyle = hexToRgba(c, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  // 绘制每条曲线
  (plot.functions || []).forEach((f, idx) => {
    const color = f.color || PALETTE[idx % PALETTE.length];
    const fn = compileExpr(f.expr, f.params || {});
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const steps = Math.max(width * 2, 600);
    let started = false;
    let prevY = null;

    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = fn(x);
      if (!isFinite(y)) {
        started = false;
        prevY = null;
        continue;
      }
      const cx = px(x);
      const cy = py(y);
      // 跳变检测（如 tan 的渐近线）
      if (prevY !== null && Math.abs(cy - prevY) > height * 1.5) {
        started = false;
      }
      if (!started) {
        ctx.moveTo(cx, cy);
        started = true;
      } else {
        ctx.lineTo(cx, cy);
      }
      prevY = cy;
    }
    ctx.stroke();
  });

  // 切线（导数的几何意义）
  (plot.tangents || []).forEach((t, idx) => {
    const fn = compileExpr(t.expr, t.params || {});
    const at = t.at !== undefined ? t.at : 0;
    const h = 1e-4;
    const slope = (fn(at + h) - fn(at - h)) / (2 * h);
    const y0v = fn(at);
    if (!isFinite(slope) || !isFinite(y0v)) return;

    const color = t.color || PALETTE[(idx + 1) % PALETTE.length];
    const xa = x0;
    const xb = x1;
    const ya = y0v + slope * (xa - at);
    const yb = y0v + slope * (xb - at);

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, width - pad.l - pad.r, height - pad.t - pad.b);
    ctx.clip();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(px(xa), py(ya));
    ctx.lineTo(px(xb), py(yb));
    ctx.stroke();
    ctx.setLineDash([]);

    // 切点
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px(at), py(y0v), 4, 0, Math.PI * 2);
    ctx.fill();

    if (t.label) {
      drawTag(ctx, t.label, px(at) + 10, py(y0v) - 10, color);
    }
    ctx.restore();
  });

  // 图例
  const legendItems = [];
  (plot.functions || []).forEach((f, idx) => {
    if (f.label) legendItems.push({ label: f.label, color: f.color || PALETTE[idx % PALETTE.length] });
  });
  (plot.fills || []).forEach((f, idx) => {
    if (f.label) legendItems.push({ label: f.label, color: f.color || PALETTE[idx % PALETTE.length] });
  });
  (plot.tangents || []).forEach((t, idx) => {
    if (t.label && legendItems.length) return; // 切点标签已就近显示
    if (t.label) legendItems.push({ label: t.label, color: t.color || PALETTE[(idx + 1) % PALETTE.length] });
  });

  if (legendItems.length) {
    let lx = pad.l + 6;
    const ly = pad.t + 4;
    legendItems.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, ly - 6, 14, 2.5);
      ctx.fillStyle = "rgba(210, 220, 245, 0.9)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(item.label, lx + 19, ly);
      lx += ctx.measureText(item.label).width + 40;
    });
  }
}

/* 带底色的文字标签，避免压在线条上看不清 */
function drawTag(ctx, text, x, y, color, align = "left") {
  ctx.font = "11px -apple-system, 'PingFang SC', sans-serif";
  const w = ctx.measureText(text).width;
  const padX = 5;
  const padY = 3;
  let bx = x;
  if (align === "center") bx = x - w / 2;
  else if (align === "right") bx = x - w;

  ctx.fillStyle = "rgba(5, 6, 15, 0.82)";
  ctx.beginPath();
  const r = 4;
  const bw = w + padX * 2;
  const bh = 15 + padY;
  const by = y - 12;
  ctx.moveTo(bx - padX + r, by);
  ctx.lineTo(bx - padX + bw - r, by);
  ctx.quadraticCurveTo(bx - padX + bw, by, bx - padX + bw, by + r);
  ctx.lineTo(bx - padX + bw, by + bh - r);
  ctx.quadraticCurveTo(bx - padX + bw, by + bh, bx - padX + bw - r, by + bh);
  ctx.lineTo(bx - padX + r, by + bh);
  ctx.quadraticCurveTo(bx - padX, by + bh, bx - padX, by + bh - r);
  ctx.lineTo(bx - padX, by + r);
  ctx.quadraticCurveTo(bx - padX, by, bx - padX + r, by);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.fillText(text, bx, y);
}

/* 把 #rrggbb 或 rgb() 转成带透明度的颜色 */
function hexToRgba(color, alpha) {
  if (color.startsWith("rgba")) return color;
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  const h = color.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ============================================================
   平面几何图形
   ============================================================ */
function drawGeometry(ctx, plot, width, height) {
  const pad = 30;
  const [x0, x1] = plot.xRange || [-5, 5];
  const [y0, y1] = plot.yRange || [-5, 5];
  const px = (x) => pad + ((x - x0) / (x1 - x0)) * (width - 2 * pad);
  const py = (y) => height - pad - ((y - y0) / (y1 - y0)) * (height - 2 * pad);

  // 元素：points, segments, circles, polygons, labels, arcs, axes
  (plot.elements || []).forEach((el) => {
    const color = el.color || "rgba(160, 175, 220, 0.85)";

    if (el.type === "axes") {
      ctx.strokeStyle = "rgba(160, 175, 220, 0.5)";
      ctx.lineWidth = 1;
      if (y0 <= 0 && 0 <= y1) {
        ctx.beginPath();
        ctx.moveTo(px(x0), py(0));
        ctx.lineTo(px(x1), py(0));
        ctx.stroke();
      }
      if (x0 <= 0 && 0 <= x1) {
        ctx.beginPath();
        ctx.moveTo(px(0), py(y0));
        ctx.lineTo(px(0), py(y1));
        ctx.stroke();
      }
    } else if (el.type === "circle") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(el.cx), py(el.cy), Math.abs(px(el.r) - px(0)), 0, Math.PI * 2);
      ctx.stroke();
      if (el.fill) {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
    } else if (el.type === "segment") {
      ctx.strokeStyle = color;
      ctx.lineWidth = el.width || 2;
      if (el.dash) ctx.setLineDash(el.dash === true ? [6, 4] : el.dash);
      ctx.beginPath();
      ctx.moveTo(px(el.from[0]), py(el.from[1]));
      ctx.lineTo(px(el.to[0]), py(el.to[1]));
      ctx.stroke();
      ctx.setLineDash([]);

      // 箭头（画向量用）
      if (el.arrow) {
        const x1 = px(el.from[0]);
        const y1 = py(el.from[1]);
        const x2 = px(el.to[0]);
        const y2 = py(el.to[1]);
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const hl = Math.min(11, Math.hypot(x2 - x1, y2 - y1) * 0.3);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - hl * Math.cos(ang - 0.36), y2 - hl * Math.sin(ang - 0.36));
        ctx.lineTo(x2 - hl * Math.cos(ang + 0.36), y2 - hl * Math.sin(ang + 0.36));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    } else if (el.type === "polygon") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      el.points.forEach((p, i) => {
        const X = px(p[0]);
        const Y = py(p[1]);
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      });
      ctx.closePath();
      if (el.fill) {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      ctx.stroke();
    } else if (el.type === "point") {
      ctx.fillStyle = el.color || "#ff6b9d";
      ctx.beginPath();
      ctx.arc(px(el.at[0]), py(el.at[1]), el.r || 4, 0, Math.PI * 2);
      ctx.fill();
      if (el.label) {
        ctx.fillStyle = "rgba(220, 228, 250, 0.95)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(el.label, px(el.at[0]) + 7, py(el.at[1]) - 7);
      }
    } else if (el.type === "arc") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        px(el.cx),
        py(el.cy),
        Math.abs(px(el.r) - px(0)),
        -el.start,
        -el.end,
        true
      );
      ctx.stroke();
    } else if (el.type === "label") {
      ctx.fillStyle = el.color || "rgba(220, 228, 250, 0.95)";
      ctx.font = (el.size || 12) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(el.text, px(el.at[0]), py(el.at[1]));
    }
  });
}

/* ============================================================
   单位圆与三角函数
   ============================================================ */
function drawUnitCircle(ctx, plot, width, height) {
  const size = Math.min(width, height - 24) - 30;
  const cx = width / 2;
  const cy = height / 2 + 8;
  const R = size / 2;
  const angle = plot.angle || Math.PI / 3;

  // 坐标轴
  ctx.strokeStyle = "rgba(160, 175, 220, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - R - 20, cy);
  ctx.lineTo(cx + R + 20, cy);
  ctx.moveTo(cx, cy - R - 20);
  ctx.lineTo(cx, cy + R + 20);
  ctx.stroke();

  // 单位圆
  ctx.strokeStyle = "rgba(120, 140, 255, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  const px = cx + R * Math.cos(angle);
  const py = cy - R * Math.sin(angle);

  // 角度扇形
  ctx.fillStyle = "rgba(76, 201, 240, 0.18)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R * 0.32, 0, -angle, true);
  ctx.closePath();
  ctx.fill();

  // sin / cos 投影
  ctx.strokeStyle = "#ff6b9d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, cy);
  ctx.stroke();

  ctx.strokeStyle = "#06d6a0";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(px, cy);
  ctx.stroke();

  // 半径
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(px, py);
  ctx.stroke();

  // 点与标签
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#ff6b9d";
  ctx.textAlign = "left";
  ctx.fillText("sin θ", px + 8, (py + cy) / 2);
  ctx.fillStyle = "#06d6a0";
  ctx.textAlign = "center";
  ctx.fillText("cos θ", (cx + px) / 2, cy - 8);
  ctx.fillStyle = "#ffd166";
  ctx.fillText("θ", cx + R * 0.22, cy - R * 0.08);
  ctx.fillStyle = "rgba(210, 220, 245, 0.9)";
  ctx.textAlign = "left";
  ctx.fillText(`(cos θ, sin θ)`, px + 8, py - 8);
}

/* ============================================================
   数轴
   ============================================================ */
function drawNumberLine(ctx, plot, width, height) {
  const y = height / 2;
  const pad = 30;
  const [a, b] = plot.range || [-5, 5];
  const px = (x) => pad + ((x - a) / (b - a)) * (width - 2 * pad);

  ctx.strokeStyle = "rgba(160, 175, 220, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();

  // 箭头
  ctx.beginPath();
  ctx.moveTo(width - pad, y);
  ctx.lineTo(width - pad - 8, y - 5);
  ctx.lineTo(width - pad - 8, y + 5);
  ctx.closePath();
  ctx.fillStyle = "rgba(160, 175, 220, 0.85)";
  ctx.fill();

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "rgba(140, 155, 200, 0.9)";
  ctx.textAlign = "center";

  for (let x = Math.ceil(a); x <= b; x++) {
    ctx.beginPath();
    ctx.moveTo(px(x), y - 5);
    ctx.lineTo(px(x), y + 5);
    ctx.stroke();
    ctx.fillText(x, px(x), y + 20);
  }

  // 标记点
  (plot.points || []).forEach((p) => {
    ctx.fillStyle = p.color || "#ff6b9d";
    ctx.beginPath();
    ctx.arc(px(p.at), y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (p.label) {
      ctx.fillStyle = "rgba(220, 228, 250, 0.95)";
      ctx.font = "12px sans-serif";
      ctx.fillText(p.label, px(p.at), y - 12);
    }
  });

  // 区间
  (plot.intervals || []).forEach((iv) => {
    ctx.strokeStyle = iv.color || "#4cc9f0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(iv.from), y);
    ctx.lineTo(px(iv.to), y);
    ctx.stroke();
  });
}

/* 按数据范围保持长宽比的绘图区（等高线、向量场用） */
function makeScaler(plot, width, height, margin = 30) {
  const [x0, x1] = plot.xRange || [-3, 3];
  const [y0, y1] = plot.yRange || [-3, 3];
  const availW = width - margin * 2;
  const availH = height - margin * 2;
  const dataAspect = (x1 - x0) / (y1 - y0);
  const availAspect = availW / availH;

  let w;
  let h;
  if (dataAspect > availAspect) {
    w = availW;
    h = availW / dataAspect;
  } else {
    h = availH;
    w = availH * dataAspect;
  }
  const left = margin + (availW - w) / 2;
  const top = margin + (availH - h) / 2;

  return {
    box: { left, top, w, h },
    xRange: [x0, x1],
    yRange: [y0, y1],
    px: (x) => left + ((x - x0) / (x1 - x0)) * w,
    py: (y) => top + h - ((y - y0) / (y1 - y0)) * h,
  };
}

/* ============================================================
   等高线图（二元函数 f(x,y) 的等值线）
   ============================================================ */
function drawContour(ctx, plot, width, height) {
  const { px, py, box, xRange: [x0, x1], yRange: [y0v, y1v] } = makeScaler(plot, width, height);

  const fn = compileExpr2(plot.expr, plot.params || {});
  const N = Math.min(plot.resolution || 90, 140);

  // 采样网格
  const g = [];
  let maxAbs = 0;
  for (let j = 0; j <= N; j++) {
    const row = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const y = y0v + ((y1v - y0v) * j) / N;
      const v = fn(x, y);
      row[i] = v;
      if (isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    g.push(row);
  }
  if (maxAbs === 0) maxAbs = 1;

  const levelRange = plot.levelRange || [-maxAbs, maxAbs];
  const levels = plot.levels || 11;

  // 可选：按函数值铺一层底色
  if (plot.heat !== false) {
    const cell = 4;
    for (let sy = 0; sy < box.h; sy += cell) {
      for (let sx = 0; sx < box.w; sx += cell) {
        const x = x0 + ((x1 - x0) * sx) / box.w;
        const y = y1v - ((y1v - y0v) * sy) / box.h;
        const v = fn(x, y);
        if (!isFinite(v)) continue;
        const t = Math.min(1, Math.max(0, (v - levelRange[0]) / (levelRange[1] - levelRange[0])));
        ctx.fillStyle = `hsla(${210 + t * 110}, 70%, 55%, 0.055)`;
        ctx.fillRect(box.left + sx, box.top + sy, cell, cell);
      }
    }
  }

  const X = (i) => px(x0 + ((x1 - x0) * i) / N);
  const Y = (j) => py(y0v + ((y1v - y0v) * j) / N);

  for (let k = 0; k < levels; k++) {
    const t = (k + 0.5) / levels;
    const level = levelRange[0] + (levelRange[1] - levelRange[0]) * t;

    ctx.strokeStyle = plot.monoColor
      ? `hsla(200, 80%, 70%, ${0.3 + t * 0.45})`
      : `hsla(${195 + t * 135}, 85%, ${56 + t * 10}%, ${0.35 + t * 0.5})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = g[j][i];
        const b = g[j][i + 1];
        const c = g[j + 1][i + 1];
        const d = g[j + 1][i];
        if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) continue;

        let idx = 0;
        if (a > level) idx |= 1;
        if (b > level) idx |= 2;
        if (c > level) idx |= 4;
        if (d > level) idx |= 8;
        if (idx === 0 || idx === 15) continue;

        const it = (v1, v2) => (level - v1) / (v2 - v1);
        const eAB = () => [X(i) + (X(i + 1) - X(i)) * it(a, b), Y(j)];
        const eBC = () => [X(i + 1), Y(j) + (Y(j + 1) - Y(j)) * it(b, c)];
        const eCD = () => [X(i) + (X(i + 1) - X(i)) * it(d, c), Y(j + 1)];
        const eDA = () => [X(i), Y(j) + (Y(j + 1) - Y(j)) * it(a, d)];

        const seg = (p1, p2) => {
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
        };

        switch (idx) {
          case 1: case 14: seg(eDA(), eAB()); break;
          case 2: case 13: seg(eAB(), eBC()); break;
          case 3: case 12: seg(eDA(), eBC()); break;
          case 4: case 11: seg(eBC(), eCD()); break;
          case 5: seg(eDA(), eAB()); seg(eBC(), eCD()); break;
          case 6: case 9: seg(eAB(), eCD()); break;
          case 7: case 8: seg(eCD(), eDA()); break;
          case 10: seg(eAB(), eBC()); seg(eCD(), eDA()); break;
        }
      }
    }
    ctx.stroke();
  }

  // 坐标轴
  ctx.strokeStyle = "rgba(160, 175, 220, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (y0v <= 0 && 0 <= y1v) {
    ctx.moveTo(box.left, py(0));
    ctx.lineTo(box.left + box.w, py(0));
  }
  if (x0 <= 0 && 0 <= x1) {
    ctx.moveTo(px(0), box.top);
    ctx.lineTo(px(0), box.top + box.h);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(120, 140, 255, 0.22)";
  ctx.strokeRect(box.left, box.top, box.w, box.h);
}

/* ============================================================
   向量场 / 梯度场
   ============================================================ */
function drawVectorField(ctx, plot, width, height) {
  const { px, py, box, xRange: [x0, x1], yRange: [y0v, y1v] } = makeScaler(plot, width, height);

  const nx = (plot.density && plot.density[0]) || 16;
  const ny = (plot.density && plot.density[1]) || 14;

  // 背景：可选的标量场等高线
  if (plot.contourExpr) {
    drawContour(ctx, {
      expr: plot.contourExpr,
      params: plot.params,
      xRange: [x0, x1],
      yRange: [y0v, y1v],
      levels: 9,
      resolution: 70,
      heat: false,
    }, width, height);
  }

  const fx = compileExpr2(plot.fx, plot.params || {});
  const fy = compileExpr2(plot.fy, plot.params || {});

  const arrows = [];
  let maxMag = 0;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / (nx + 1);
      const y = y0v + ((y1v - y0v) * (j + 0.5)) / (ny + 1);
      const u = fx(x, y);
      const v = fy(x, y);
      if (!isFinite(u) || !isFinite(v)) continue;
      const m = Math.hypot(u, v);
      if (m > maxMag) maxMag = m;
      arrows.push({ x, y, u, v, m });
    }
  }
  if (maxMag === 0) maxMag = 1;

  const cellW = (x1 - x0) / (nx + 1);
  const cellH = (y1v - y0v) / (ny + 1);
  const scale = plot.arrowScale || 1.15;

  ctx.lineWidth = 1.4;
  arrows.forEach((a) => {
    const rel = a.m / maxMag;
    if (rel < 0.015) return;
    const lenRel = Math.pow(rel, 0.42);
    const ux = a.u / (a.m || 1);
    const uy = a.v / (a.m || 1);
    const ex = a.x + ux * cellW * lenRel * scale;
    const ey = a.y + uy * cellH * lenRel * scale;

    const X = px(a.x);
    const Y = py(a.y);
    const EX = px(ex);
    const EY = py(ey);

    ctx.strokeStyle = `hsla(${200 - rel * 150}, 88%, ${58 + rel * 12}%, ${0.28 + rel * 0.62})`;
    ctx.beginPath();
    ctx.moveTo(X, Y);
    ctx.lineTo(EX, EY);
    ctx.stroke();

    // 箭头头部
    const ang = Math.atan2(EY - Y, EX - X);
    const hl = Math.min(7, Math.hypot(EX - X, EY - Y) * 0.45);
    if (hl > 2) {
      ctx.beginPath();
      ctx.moveTo(EX, EY);
      ctx.lineTo(EX - hl * Math.cos(ang - 0.4), EY - hl * Math.sin(ang - 0.4));
      ctx.lineTo(EX - hl * Math.cos(ang + 0.4), EY - hl * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  });

  // 标注点
  (plot.marks || []).forEach((m) => {
    ctx.fillStyle = m.color || "#ffd166";
    ctx.beginPath();
    ctx.arc(px(m.at[0]), py(m.at[1]), 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (m.label) {
      drawTag(ctx, m.label, px(m.at[0]) + 9, py(m.at[1]) - 9, "rgba(230, 236, 255, 0.95)");
    }
  });

  // 坐标轴
  ctx.strokeStyle = "rgba(160, 175, 220, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (y0v <= 0 && 0 <= y1v) {
    ctx.moveTo(box.left, py(0));
    ctx.lineTo(box.left + box.w, py(0));
  }
  if (x0 <= 0 && 0 <= x1) {
    ctx.moveTo(px(0), box.top);
    ctx.lineTo(px(0), box.top + box.h);
  }
  ctx.stroke();
}

/* ============================================================
   共形映射（复变函数）：把 z 平面的正方形网格映到 w 平面
   ============================================================ */
function drawConformal(ctx, plot, width, height) {
  const pad = 28;
  const reFn = compileExpr2(plot.re, plot.params || {});
  const imFn = compileExpr2(plot.im, plot.params || {});

  const [zx0, zx1] = plot.zRange || [-2, 2];
  const [zy0, zy1] = plot.zRange || [-2, 2];
  const density = plot.density || 9;
  const steps = 140;

  // 采样：先收集全部网格点，用于自动确定 w 平面显示范围
  const lines = [];
  const sampleU = [];
  const sampleV = [];

  const push = (arr, x, y) => {
    const u = reFn(x, y);
    const v = imFn(x, y);
    arr.push([u, v]);
    if (isFinite(u)) sampleU.push(u);
    if (isFinite(v)) sampleV.push(v);
  };

  // 竖线 x = const
  for (let i = 0; i < density; i++) {
    const x = zx0 + ((zx1 - zx0) * i) / (density - 1);
    const pts = [];
    for (let s = 0; s <= steps; s++) {
      const y = zy0 + ((zy1 - zy0) * s) / steps;
      push(pts, x, y);
    }
    lines.push({ pts, kind: "vertical", key: Math.abs(x) < 1e-9 ? 0 : x });
  }
  // 横线 y = const
  for (let i = 0; i < density; i++) {
    const y = zy0 + ((zy1 - zy0) * i) / (density - 1);
    const pts = [];
    for (let s = 0; s <= steps; s++) {
      const x = zx0 + ((zx1 - zx0) * s) / steps;
      push(pts, x, y);
    }
    lines.push({ pts, kind: "horizontal", key: Math.abs(y) < 1e-9 ? 0 : y });
  }

  // 确定 w 平面范围（去掉极端值，避免奇异点把画面拉爆）
  const spanOf = (arr, fallback) => {
    if (!arr.length) return fallback;
    const sorted = arr.slice().sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.02)];
    const hi = sorted[Math.floor(sorted.length * 0.98)];
    const pad2 = Math.max(0.5, (hi - lo) * 0.12);
    return [lo - pad2, hi + pad2];
  };

  let uRange;
  let vRange;
  if (plot.outRange) {
    const r = plot.outRange;
    uRange = Array.isArray(r[0]) ? r[0] : r;
    vRange = Array.isArray(r[0]) ? r[1] : r;
  } else {
    uRange = spanOf(sampleU, [-2, 2]);
    vRange = spanOf(sampleV, [-2, 2]);
  }

  const [u0, u1] = uRange;
  const [v0, v1] = vRange;
  const px = (u) => pad + ((u - u0) / (u1 - u0)) * (width - 2 * pad);
  const py = (v) => height - pad - ((v - v0) / (v1 - v0)) * (height - 2 * pad);

  // w 平面直角坐标底纹
  ctx.strokeStyle = "rgba(120, 140, 255, 0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const unitU = niceStep((u1 - u0) / 6);
  const unitV = niceStep((v1 - v0) / 6);
  for (let u = Math.ceil(u0 / unitU) * unitU; u <= u1; u += unitU) {
    ctx.moveTo(px(u), pad);
    ctx.lineTo(px(u), height - pad);
  }
  for (let v = Math.ceil(v0 / unitV) * unitV; v <= v1; v += unitV) {
    ctx.moveTo(pad, py(v));
    ctx.lineTo(width - pad, py(v));
  }
  ctx.stroke();

  // w 平面坐标轴
  ctx.strokeStyle = "rgba(160, 175, 220, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (v0 <= 0 && 0 <= v1) {
    ctx.moveTo(pad, py(0));
    ctx.lineTo(width - pad, py(0));
  }
  if (u0 <= 0 && 0 <= u1) {
    ctx.moveTo(px(0), pad);
    ctx.lineTo(px(0), height - pad);
  }
  ctx.stroke();

  // 网格像
  const guard = Math.max(u1 - u0, v1 - v0) * 3;
  ctx.lineWidth = 1.15;
  lines.forEach((line) => {
    const isAxis = line.key === 0;
    if (isAxis) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = 1.7;
    } else if (line.kind === "vertical") {
      ctx.strokeStyle = "rgba(76, 201, 240, 0.42)";
      ctx.lineWidth = 1.15;
    } else {
      ctx.strokeStyle = "rgba(255, 107, 157, 0.42)";
      ctx.lineWidth = 1.15;
    }

    ctx.beginPath();
    let prev = null;
    line.pts.forEach(([u, v]) => {
      if (!isFinite(u) || !isFinite(v)) {
        prev = null;
        return;
      }
      // 远离画面的点跳过，避免画出爆掉的直线
      if (
        Math.abs(u - (u0 + u1) / 2) > guard ||
        Math.abs(v - (v0 + v1) / 2) > guard
      ) {
        prev = null;
        return;
      }
      const X = px(u);
      const Y = py(v);
      if (prev) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
      prev = [X, Y];
    });
    ctx.stroke();
  });

  // 坐标标注
  ctx.fillStyle = "rgba(150, 165, 205, 0.8)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  for (let u = Math.ceil(u0 / unitU) * unitU; u <= u1; u += unitU) {
    if (Math.abs(u) < 1e-9) continue;
    ctx.fillText(fmtNum(u), px(u), height - pad + 13);
  }
  ctx.textAlign = "right";
  for (let v = Math.ceil(v0 / unitV) * unitV; v <= v1; v += unitV) {
    if (Math.abs(v) < 1e-9) continue;
    ctx.fillText(fmtNum(v), pad - 5, py(v) + 3);
  }

  ctx.strokeStyle = "rgba(120, 140, 255, 0.22)";
  ctx.strokeRect(pad, pad, width - 2 * pad, height - 2 * pad);
}

/* ============================================================
   斜率场 / 方向场（一阶微分方程）+ 可选解曲线
   ============================================================ */
function drawSlopeField(ctx, plot, width, height) {
  const pad = 30;
  const [x0, x1] = plot.xRange || [-3, 3];
  const [y0, y1] = plot.yRange || [-3, 3];
  const px = (x) => pad + ((x - x0) / (x1 - x0)) * (width - 2 * pad);
  const py = (y) => height - pad - ((y - y0) / (y1 - y0)) * (height - 2 * pad);

  const fn = compileExpr2(plot.expr, plot.params || {});
  const nx = (plot.density && plot.density[0]) || 19;
  const ny = (plot.density && plot.density[1]) || 15;

  const cellW = (x1 - x0) / nx;
  const cellH = (y1 - y0) / ny;
  const L = Math.min(cellW, cellH) * 0.62;

  // 网格底纹
  ctx.strokeStyle = "rgba(120, 140, 255, 0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= nx; i++) {
    ctx.moveTo(px(x0 + i * cellW), pad);
    ctx.lineTo(px(x0 + i * cellW), height - pad);
  }
  for (let j = 0; j <= ny; j++) {
    ctx.moveTo(pad, py(y0 + j * cellH));
    ctx.lineTo(width - pad, py(y0 + j * cellH));
  }
  ctx.stroke();

  // 斜率短线
  ctx.lineWidth = 1.3;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x = x0 + (i + 0.5) * cellW;
      const y = y0 + (j + 0.5) * cellH;
      const s = fn(x, y);
      if (!isFinite(s)) continue;
      const len = Math.hypot(1, s);
      const dx = (1 / len) * L;
      const dy = (s / len) * L;
      const t = Math.min(1, Math.abs(s) / 3);
      ctx.strokeStyle = `hsla(${200 - t * 140}, 85%, 62%, 0.42)`;
      ctx.beginPath();
      ctx.moveTo(px(x - dx), py(y - dy));
      ctx.lineTo(px(x + dx), py(y + dy));
      ctx.stroke();
    }
  }

  // 解曲线（RK4 数值积分）
  (plot.initial || []).forEach((init, idx) => {
    const color = init.color || PALETTE[idx % PALETTE.length];
    const steps = 900;

    const integrate = (dir) => {
      const h = ((x1 - x0) / steps) * dir;
      let x = init.x;
      let y = init.y;
      const pts = [[x, y]];
      for (let k = 0; k < steps; k++) {
        const k1 = fn(x, y);
        const k2 = fn(x + h / 2, y + (h * k1) / 2);
        const k3 = fn(x + h / 2, y + (h * k2) / 2);
        const k4 = fn(x + h, y + h * k3);
        const yn = y + (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
        x += h;
        y = yn;
        if (!isFinite(y)) break;
        if (x < x0 - 1 || x > x1 + 1) break;
        if (y < y0 - 4 * (y1 - y0) || y > y1 + 4 * (y1 - y0)) break;
        pts.push([x, y]);
      }
      return pts;
    };

    const all = integrate(-1).reverse().concat(integrate(1).slice(1));
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    all.forEach(([x, y], i) => {
      const X = px(x);
      const Y = py(y);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.stroke();

    // 初值点
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px(init.x), py(init.y), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (init.label) {
      drawTag(ctx, init.label, px(init.x) + 9, py(init.y) - 9, color);
    }
  });

  // 坐标轴
  ctx.strokeStyle = "rgba(160, 175, 220, 0.5)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (y0 <= 0 && 0 <= y1) {
    ctx.moveTo(pad, py(0));
    ctx.lineTo(width - pad, py(0));
  }
  if (x0 <= 0 && 0 <= x1) {
    ctx.moveTo(px(0), pad);
    ctx.lineTo(px(0), height - pad);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(150, 165, 205, 0.85)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  for (let x = Math.ceil(x0); x <= x1; x++) {
    if (x === 0) continue;
    ctx.fillText(fmtNum(x), px(x), height - pad + 13);
  }
  ctx.textAlign = "right";
  for (let y = Math.ceil(y0); y <= y1; y++) {
    if (y === 0) continue;
    ctx.fillText(fmtNum(y), pad - 5, py(y) + 3);
  }
}

/* 取整的刻度步长 */
function niceStep(raw) {
  if (!isFinite(raw) || raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}

function fmtNum(v) {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/* ============================================================
   散点图（回归分析、相关系数、抽样）
   ============================================================ */
function drawScatter(ctx, plot, width, height) {
  const pad = { l: 44, r: 18, t: 34, b: 30 };
  const pts = (plot.points || []).filter(p => isFinite(p[0]) && isFinite(p[1]));
  if (!pts.length) return;

  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  let [x0, x1] = plot.xRange || [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = plot.yRange || [Math.min(...ys), Math.max(...ys)];
  if (x1 === x0) { x0 -= 1; x1 += 1; }
  if (y1 === y0) { y0 -= 1; y1 += 1; }
  const spanX = x1 - x0;
  const spanY = y1 - y0;

  const px = (x) => pad.l + ((x - x0) / spanX) * (width - pad.l - pad.r);
  const py = (y) => height - pad.b - ((y - y0) / spanY) * (height - pad.t - pad.b);

  // 网格
  const stepX = niceStep(spanX / 6);
  const stepY = niceStep(spanY / 6);
  ctx.strokeStyle = "rgba(120, 140, 255, 0.11)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1; x += stepX) {
    ctx.moveTo(px(x), pad.t);
    ctx.lineTo(px(x), height - pad.b);
  }
  for (let y = Math.ceil(y0 / stepY) * stepY; y <= y1; y += stepY) {
    ctx.moveTo(pad.l, py(y));
    ctx.lineTo(width - pad.r, py(y));
  }
  ctx.stroke();

  // 坐标轴
  ctx.strokeStyle = "rgba(160, 175, 220, 0.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (y0 <= 0 && 0 <= y1) { ctx.moveTo(pad.l, py(0)); ctx.lineTo(width - pad.r, py(0)); }
  if (x0 <= 0 && 0 <= x1) { ctx.moveTo(px(0), pad.t); ctx.lineTo(px(0), height - pad.b); }
  ctx.stroke();

  // 刻度
  ctx.fillStyle = "rgba(150, 165, 205, 0.85)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1; x += stepX) {
    ctx.fillText(fmtNum(x), px(x), height - pad.b + 14);
  }
  ctx.textAlign = "right";
  for (let y = Math.ceil(y0 / stepY) * stepY; y <= y1; y += stepY) {
    ctx.fillText(fmtNum(y), pad.l - 6, py(y) + 3);
  }

  // 拟合线
  const lines = plot.lines || (plot.line ? [plot.line] : []);
  lines.forEach((ln, idx) => {
    const color = ln.color || PALETTE[(idx + 1) % PALETTE.length];
    const a = ln.slope !== undefined ? ln.slope : 1;
    const b = ln.intercept !== undefined ? ln.intercept : 0;
    const xa = ln.from !== undefined ? ln.from : x0;
    const xb = ln.to !== undefined ? ln.to : x1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(xa), py(a * xa + b));
    ctx.lineTo(px(xb), py(a * xb + b));
    ctx.stroke();
    if (ln.label) drawTag(ctx, ln.label, px(xb) - 8, py(a * xb + b) - 12, color, "right");
  });

  // 散点
  const dotColor = plot.pointColor || "#4cc9f0";
  const dotR = plot.pointSize || 3.6;
  pts.forEach(p => {
    ctx.fillStyle = dotColor;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(px(p[0]), py(p[1]), dotR, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // 标注点
  (plot.marks || []).forEach(m => {
    ctx.fillStyle = m.color || "#ffd166";
    ctx.beginPath();
    ctx.arc(px(m.at[0]), py(m.at[1]), 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (m.label) drawTag(ctx, m.label, px(m.at[0]) + 9, py(m.at[1]) - 9, "rgba(230,236,255,0.95)");
  });
}

/* ============================================================
   数值积分示意：矩形法 / 梯形法 / 辛普森法
   ============================================================ */
function drawQuadrature(ctx, plot, width, height) {
  const pad = { l: 46, r: 18, t: 38, b: 30 };
  const fn = compileExpr(plot.expr, plot.params || {});
  const a = plot.from !== undefined ? plot.from : 0;
  const b = plot.to !== undefined ? plot.to : 1;
  const n = Math.max(1, plot.n || 4);
  const method = plot.method || "trapezoid";
  const fillColor = plot.color || "#06d6a0";
  const curveColor = plot.curveColor || "#4cc9f0";
  const h = (b - a) / n;

  const [x0, x1] = plot.xRange || [a - (b - a) * 0.18, b + (b - a) * 0.18];
  let y0;
  let y1;
  if (plot.yRange) {
    [y0, y1] = plot.yRange;
  } else {
    let lo = 0;
    let hi = 0;
    for (let i = 0; i <= 300; i++) {
      const x = x0 + ((x1 - x0) * i) / 300;
      const v = fn(x);
      if (isFinite(v)) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    const m = (hi - lo) * 0.14 || 0.1;
    y0 = lo - m;
    y1 = hi + m;
  }

  const px = (x) => pad.l + ((x - x0) / (x1 - x0)) * (width - pad.l - pad.r);
  const py = (y) => height - pad.b - ((y - y0) / (y1 - y0)) * (height - pad.t - pad.b);

  // 网格
  ctx.strokeStyle = "rgba(120, 140, 255, 0.11)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const sx = niceStep((x1 - x0) / 6);
  const sy = niceStep((y1 - y0) / 5);
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) {
    ctx.moveTo(px(x), pad.t);
    ctx.lineTo(px(x), height - pad.b);
  }
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) {
    ctx.moveTo(pad.l, py(y));
    ctx.lineTo(width - pad.r, py(y));
  }
  ctx.stroke();

  // 逼近图形
  ctx.fillStyle = hexToRgba(fillColor, 0.24);
  ctx.strokeStyle = hexToRgba(fillColor, 0.6);
  ctx.lineWidth = 1;

  if (method === "simpson" && n >= 2) {
    for (let k = 0; k + 2 <= n; k += 2) {
      const xa = a + k * h;
      const xc = xa + 2 * h;
      const xm = xa + h;
      const f0 = fn(xa);
      const f1 = fn(xm);
      const f2 = fn(xc);
      if (!isFinite(f0) || !isFinite(f1) || !isFinite(f2)) continue;
      const quad = (x) => {
        const l0 = ((x - xm) * (x - xc)) / ((xa - xm) * (xa - xc));
        const l1 = ((x - xa) * (x - xc)) / ((xm - xa) * (xm - xc));
        const l2 = ((x - xa) * (x - xm)) / ((xc - xa) * (xc - xm));
        return f0 * l0 + f1 * l1 + f2 * l2;
      };
      ctx.beginPath();
      ctx.moveTo(px(xa), py(0));
      for (let s = 0; s <= 48; s++) {
        const x = xa + ((xc - xa) * s) / 48;
        ctx.lineTo(px(x), py(quad(x)));
      }
      ctx.lineTo(px(xc), py(0));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else {
    for (let k = 0; k < n; k++) {
      const xa = a + k * h;
      const xb = xa + h;
      let ya;
      let yb;
      if (method === "left") {
        ya = yb = fn(xa);
      } else if (method === "right") {
        ya = yb = fn(xb);
      } else if (method === "midpoint") {
        ya = yb = fn((xa + xb) / 2);
      } else {
        ya = fn(xa);
        yb = fn(xb);
      }
      if (!isFinite(ya) || !isFinite(yb)) continue;
      ctx.beginPath();
      ctx.moveTo(px(xa), py(0));
      ctx.lineTo(px(xa), py(ya));
      ctx.lineTo(px(xb), py(yb));
      ctx.lineTo(px(xb), py(0));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 被积函数曲线
  ctx.strokeStyle = curveColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  let started = false;
  let prevY = null;
  const steps = Math.max(width * 2, 600);
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = fn(x);
    if (!isFinite(y)) {
      started = false;
      prevY = null;
      continue;
    }
    const cx = px(x);
    const cy = py(y);
    if (prevY !== null && Math.abs(cy - prevY) > height * 1.5) started = false;
    if (!started) {
      ctx.moveTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
    prevY = cy;
  }
  ctx.stroke();

  // 坐标轴
  ctx.strokeStyle = "rgba(160, 175, 220, 0.55)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (y0 <= 0 && 0 <= y1) {
    ctx.moveTo(pad.l, py(0));
    ctx.lineTo(width - pad.r, py(0));
  }
  if (x0 <= 0 && 0 <= x1) {
    ctx.moveTo(px(0), pad.t);
    ctx.lineTo(px(0), height - pad.b);
  }
  ctx.stroke();

  // 刻度
  ctx.fillStyle = "rgba(150, 165, 205, 0.85)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) {
    ctx.fillText(fmtNum(x), px(x), height - pad.b + 14);
  }
  ctx.textAlign = "right";
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) {
    ctx.fillText(fmtNum(y), pad.l - 6, py(y) + 3);
  }

  // 近似值标签
  let approx = 0;
  if (method === "left" || method === "right" || method === "midpoint") {
    for (let k = 0; k < n; k++) {
      const xa = a + k * h;
      const xb = xa + h;
      const xm = method === "left" ? xa : method === "right" ? xb : (xa + xb) / 2;
      const v = fn(xm);
      if (isFinite(v)) approx += h * v;
    }
  } else if (method === "simpson" && n >= 2) {
    let s = fn(a) + fn(b);
    for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * fn(a + k * h);
    approx = (h / 3) * s;
  } else {
    let s = 0.5 * (fn(a) + fn(b));
    for (let k = 1; k < n; k++) s += fn(a + k * h);
    approx = h * s;
  }
  const names = { left: "左矩形", right: "右矩形", midpoint: "中点", trapezoid: "梯形", simpson: "辛普森" };
  if (isFinite(approx)) {
    drawTag(
      ctx,
      `${names[method] || method}法 n=${n}  ≈ ${approx.toFixed(5)}`,
      pad.l + 8,
      pad.t + 4,
      hexToRgba(fillColor, 0.95)
    );
  }
}

/* ============================================================
   3D 工具：正交投影 + 自动取景
   ============================================================ */
function makeProjector(plot) {
  const az = plot.azimuth !== undefined ? plot.azimuth : 0.7;
  const el = plot.elevation !== undefined ? plot.elevation : 0.45;
  const ca = Math.cos(az);
  const sa = Math.sin(az);
  const ce = Math.cos(el);
  const se = Math.sin(el);
  // 先绕 z 轴旋转 az，再绕水平轴倾斜 el；返回 [屏幕x, 屏幕y, 深度]
  return (x, y, z) => {
    const xr = x * ca - y * sa;
    const yr = x * sa + y * ca;
    return [xr, z * ce - yr * se, yr * ce + z * se];
  };
}

function fitProjection(points3, proj, width, height, pad) {
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  points3.forEach((p) => {
    const [u, v] = proj(p[0], p[1], p[2]);
    if (isFinite(u) && isFinite(v)) {
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
  });
  if (!isFinite(u0)) {
    u0 = -1;
    u1 = 1;
    v0 = -1;
    v1 = 1;
  }
  const spanU = u1 - u0 || 1;
  const spanV = v1 - v0 || 1;
  const availW = width - pad * 2;
  const availH = height - pad * 2;
  const s = Math.min(availW / spanU, availH / spanV);
  const cx = (u0 + u1) / 2;
  const cy = (v0 + v1) / 2;
  const sx = (u) => pad + availW / 2 + (u - cx) * s;
  const sy = (v) => pad + availH / 2 - (v - cy) * s;
  return { sx, sy, scale: s };
}

/* ============================================================
   3D 曲线（空间曲线、Frenet 标架）
   ============================================================ */
function drawCurve3D(ctx, plot, width, height) {
  const pad = 30;
  const fx = buildEvaluator(plot.x, plot.params || {}, ["t"]);
  const fy = buildEvaluator(plot.y, plot.params || {}, ["t"]);
  const fz = buildEvaluator(plot.z, plot.params || {}, ["t"]);
  const [t0, t1] = plot.tRange || [0, Math.PI * 2];
  const N = plot.steps || 500;

  const at = (t) => [fx(t), fy(t), fz(t)];
  const pts = [];
  const pts3 = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    const p = at(t);
    if (!isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) continue;
    pts3.push(p);
  }
  if (pts3.length < 2) return;

  const proj = makeProjector(plot);
  const { sx, sy } = fitProjection(pts3, proj, width, height, pad);

  // 坐标轴（可选）
  if (plot.axes !== false) {
    let r = 0;
    pts3.forEach((p) => {
      r = Math.max(r, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
    });
    const L = r * (plot.axisScale || 1.15);
    ctx.strokeStyle = "rgba(150, 165, 205, 0.35)";
    ctx.lineWidth = 1;
    const axes = [
      [[-L, 0, 0], [L, 0, 0]],
      [[0, -L, 0], [0, L, 0]],
      [[0, 0, -L], [0, 0, L]],
    ];
    axes.forEach(([a, b]) => {
      const [ua, va] = proj(a[0], a[1], a[2]);
      const [ub, vb] = proj(b[0], b[1], b[2]);
      ctx.beginPath();
      ctx.moveTo(sx(ua), sy(va));
      ctx.lineTo(sx(ub), sy(vb));
      ctx.stroke();
    });
  }

  // 曲线（按深度渐变的透明度）
  const color = plot.color || "#4cc9f0";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  let prev = null;
  for (let i = 0; i < pts3.length; i++) {
    const [u, v, d] = proj(pts3[i][0], pts3[i][1], pts3[i][2]);
    const X = sx(u);
    const Y = sy(v);
    if (prev) {
      const t = Math.min(1, Math.max(0, (d + 2) / 4));
      ctx.strokeStyle = hexToRgba(color, 0.45 + 0.55 * t);
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(X, Y);
      ctx.stroke();
    }
    prev = [X, Y];
  }

  // Frenet 标架
  (plot.frames || []).forEach((fr) => {
    const t = fr.at !== undefined ? fr.at : (t0 + t1) / 2;
    const h = 1e-3;
    const r0 = at(t);
    const r1 = at(t + h);
    const r2 = at(t + 2 * h);
    const r_1 = at(t - h);
    if (![r0, r1, r2, r_1].every((p) => p.every(isFinite))) return;
    const d1 = [(r1[0] - r_1[0]) / (2 * h), (r1[1] - r_1[1]) / (2 * h), (r1[2] - r_1[2]) / (2 * h)];
    const d2 = [(r1[0] - 2 * r0[0] + r_1[0]) / (h * h), (r1[1] - 2 * r0[1] + r_1[1]) / (h * h), (r1[2] - 2 * r0[2] + r_1[2]) / (h * h)];
    const n1 = Math.hypot(...d1) || 1;
    const T = d1.map((v) => v / n1);
    const dot = d2[0] * T[0] + d2[1] * T[1] + d2[2] * T[2];
    let Nv = d2.map((v, i) => v - dot * T[i]);
    const n2 = Math.hypot(...Nv);
    if (n2 < 1e-9) return;
    Nv = Nv.map((v) => v / n2);
    const B = [
      T[1] * Nv[2] - T[2] * Nv[1],
      T[2] * Nv[0] - T[0] * Nv[2],
      T[0] * Nv[1] - T[1] * Nv[0],
    ];

    let r = 0;
    pts3.forEach((p) => {
      r = Math.max(r, Math.hypot(p[0], p[1], p[2]));
    });
    const L = r * (fr.scale || 0.5);
    const origin = r0;
    const drawArrow = (vec, col, label) => {
      const end = [origin[0] + vec[0] * L, origin[1] + vec[1] * L, origin[2] + vec[2] * L];
      const [uo, vo] = proj(origin[0], origin[1], origin[2]);
      const [ue, ve] = proj(end[0], end[1], end[2]);
      const X1 = sx(uo);
      const Y1 = sy(vo);
      const X2 = sx(ue);
      const Y2 = sy(ve);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X1, Y1);
      ctx.lineTo(X2, Y2);
      ctx.stroke();
      const ang = Math.atan2(Y2 - Y1, X2 - X1);
      const hl = 9;
      ctx.beginPath();
      ctx.moveTo(X2, Y2);
      ctx.lineTo(X2 - hl * Math.cos(ang - 0.35), Y2 - hl * Math.sin(ang - 0.35));
      ctx.lineTo(X2 - hl * Math.cos(ang + 0.35), Y2 - hl * Math.sin(ang + 0.35));
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      if (label) drawTag(ctx, label, X2 + 6, Y2 - 6, col);
    };
    drawArrow(T, "#ff6b9d", "T");
    drawArrow(Nv, "#06d6a0", "N");
    drawArrow(B, "#ffd166", "B");

    // 切点
    const [u0p, v0p] = proj(origin[0], origin[1], origin[2]);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sx(u0p), sy(v0p), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ============================================================
   3D 曲面（z=f(x,y) 或参数曲面），用带光照的网格绘制
   ============================================================ */
function drawSurface3D(ctx, plot, width, height) {
  const pad = 26;
  const nu = plot.density && plot.density[0] ? plot.density[0] : 22;
  const nv = plot.density && plot.density[1] ? plot.density[1] : 22;
  const baseColor = new THREE_COLOR(plot.color || "#4cc9f0");

  let at;
  if (plot.surf) {
    const fx = buildEvaluator(plot.surf.x, plot.params || {}, ["u", "v"]);
    const fy = buildEvaluator(plot.surf.y, plot.params || {}, ["u", "v"]);
    const fz = buildEvaluator(plot.surf.z, plot.params || {}, ["u", "v"]);
    const [u0, u1] = plot.uRange || [0, Math.PI * 2];
    const [v0, v1] = plot.vRange || [0, Math.PI];
    at = (i, j) => {
      const u = u0 + ((u1 - u0) * i) / nu;
      const v = v0 + ((v1 - v0) * j) / nv;
      return [fx(u, v), fy(u, v), fz(u, v)];
    };
  } else {
    const f = compileExpr2(plot.expr, plot.params || {});
    const [x0, x1] = plot.xRange || [-1, 1];
    const [y0, y1] = plot.yRange || [-1, 1];
    at = (i, j) => {
      const x = x0 + ((x1 - x0) * i) / nu;
      const y = y0 + ((y1 - y0) * j) / nv;
      return [x, y, f(x, y)];
    };
  }

  // 采样
  const grid = [];
  const all = [];
  for (let i = 0; i <= nu; i++) {
    grid[i] = [];
    for (let j = 0; j <= nv; j++) {
      const p = at(i, j);
      grid[i][j] = p.every(isFinite) ? p : null;
      if (grid[i][j]) all.push(p);
    }
  }
  if (!all.length) return;

  const proj = makeProjector(plot);
  const { sx, sy } = fitProjection(all, proj, width, height, pad);

  // 组四边形并按深度排序（画家算法）
  const quads = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = grid[i][j];
      const b = grid[i + 1][j];
      const c = grid[i + 1][j + 1];
      const d = grid[i][j + 1];
      if (!a || !b || !c || !d) continue;
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const nrm = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ];
      const nl = Math.hypot(...nrm) || 1;
      const n0 = nrm.map((v) => v / nl);
      const pts4 = [a, b, c, d];
      const pd = pts4.map((p) => proj(p[0], p[1], p[2]));
      const depth = (pd[0][2] + pd[1][2] + pd[2][2] + pd[3][2]) / 4;
      quads.push({ pd, n: n0, depth });
    }
  }
  quads.sort((p, q) => p.depth - q.depth);

  // 光照方向（视图坐标下的固定方向）
  const L = [0.4, 0.55, 0.73];
  const wire = plot.wire === true;

  quads.forEach((q) => {
    let sh = Math.abs(q.n[0] * L[0] + q.n[1] * L[1] + q.n[2] * L[2]);
    sh = 0.3 + 0.7 * sh;
    const col = {
      r: Math.min(255, Math.round(baseColor.r * 255 * sh)),
      g: Math.min(255, Math.round(baseColor.g * 255 * sh)),
      b: Math.min(255, Math.round(baseColor.b * 255 * sh)),
    };
    // 网格线
    ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},0.55)`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx(q.pd[0][0]), sy(q.pd[0][1]));
    for (let k = 1; k < 4; k++) ctx.lineTo(sx(q.pd[k][0]), sy(q.pd[k][1]));
    ctx.closePath();
    if (!wire) {
      ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
      ctx.fill();
    }
    ctx.stroke();
  });
}

/* 把 #rrggbb 解析成 {r,g,b}（0~1） */
function THREE_COLOR(hex) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(f.slice(0, 2), 16) / 255,
    g: parseInt(f.slice(2, 4), 16) / 255,
    b: parseInt(f.slice(4, 6), 16) / 255,
  };
}
