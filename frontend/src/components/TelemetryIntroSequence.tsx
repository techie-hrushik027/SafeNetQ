import { useEffect, useRef } from 'react';
import { ZapOff } from 'lucide-react';
import './TelemetryIntroSequence.css';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothRange = (value: number, start: number, end: number) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

function randomAt(seed: number, index: number) {
  const value = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function polygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, fill: CanvasGradient | string) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawPole(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, scale: number) {
  const poleWidth = 24 * scale;
  const depth = 13 * scale;
  const topHalf = poleWidth * 0.38;
  const baseHalf = poleWidth * 0.5;
  const barY = top + 25 * scale;
  const barWidth = 226 * scale;
  const barDepth = 15 * scale;

  ctx.save();
  ctx.globalAlpha = 0.46;
  ctx.filter = `blur(${12 * scale}px)`;
  ctx.fillStyle = '#02060c';
  ctx.beginPath();
  ctx.ellipse(x + 4 * scale, bottom + 3 * scale, 34 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const wood = ctx.createLinearGradient(x - topHalf, 0, x + baseHalf + depth, 0);
  wood.addColorStop(0, '#191e24');
  wood.addColorStop(0.19, '#78684c');
  wood.addColorStop(0.4, '#514936');
  wood.addColorStop(0.61, '#292b2a');
  wood.addColorStop(0.8, '#151d24');
  wood.addColorStop(1, '#080f17');
  polygon(ctx, [
    [x - topHalf, top], [x + topHalf, top + 2 * scale],
    [x + baseHalf, bottom], [x - baseHalf, bottom - 2 * scale],
  ], wood);
  const sideFace = ctx.createLinearGradient(x + topHalf, 0, x + baseHalf + depth, 0);
  sideFace.addColorStop(0, '#292b29');
  sideFace.addColorStop(0.35, '#171e23');
  sideFace.addColorStop(1, '#080e15');
  polygon(ctx, [
    [x + topHalf, top + 2 * scale], [x + topHalf + depth, top - 2 * scale],
    [x + baseHalf + depth, bottom - 8 * scale], [x + baseHalf, bottom],
  ], sideFace);
  ctx.fillStyle = '#8e805d';
  ctx.beginPath();
  ctx.ellipse(x, top, topHalf, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#34352e';
  ctx.beginPath();
  ctx.ellipse(x + 2 * scale, top - 0.5 * scale, topHalf * 0.72, 2.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const highlight = ctx.createLinearGradient(x - topHalf * 0.5, 0, x - baseHalf * 0.38, 0);
  highlight.addColorStop(0, 'rgba(255, 224, 153, 0)');
  highlight.addColorStop(0.5, 'rgba(255, 224, 153, 0.42)');
  highlight.addColorStop(1, 'rgba(255, 224, 153, 0)');
  polygon(ctx, [
    [x - topHalf * 0.52, top + 3 * scale], [x - topHalf * 0.16, top + 4 * scale],
    [x - baseHalf * 0.18, bottom - 4 * scale], [x - baseHalf * 0.56, bottom - 5 * scale],
  ], highlight);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = '#a28a61';
  ctx.lineWidth = 0.8 * scale;
  for (let index = 0; index < 9; index += 1) {
    const offset = (randomAt(14 + scale, index) - 0.5) * poleWidth * 0.56;
    ctx.beginPath();
    ctx.moveTo(x + offset, top + (index % 3) * 9 * scale);
    ctx.bezierCurveTo(x + offset - 2 * scale, top + (bottom - top) * 0.3, x + offset + 2 * scale, top + (bottom - top) * 0.65, x + offset, bottom - index * 2 * scale);
    ctx.stroke();
  }
  ctx.restore();

  const armLeft = x - barWidth / 2;
  const armRight = x + barWidth / 2;
  polygon(ctx, [
    [armLeft, barY], [armRight, barY], [armRight + depth, barY - barDepth], [armLeft + depth, barY - barDepth],
  ], '#374452');
  polygon(ctx, [
    [armLeft, barY], [armRight, barY], [armRight, barY + barDepth], [armLeft, barY + barDepth],
  ], '#5a5548');
  polygon(ctx, [
    [armRight, barY], [armRight + depth, barY - barDepth], [armRight + depth, barY], [armRight, barY + barDepth],
  ], '#151e28');

  ctx.strokeStyle = 'rgba(177, 196, 208, 0.43)';
  ctx.lineWidth = 2.2 * scale;
  ctx.beginPath();
  ctx.moveTo(x - 28 * scale, top + 38 * scale);
  ctx.lineTo(x, top + 8 * scale);
  ctx.lineTo(x + 28 * scale, top + 38 * scale);
  ctx.stroke();

  const anchors: Array<[number, number]> = [];
  [-0.31, 0, 0.31].forEach((ratio, index) => {
    const insulatorX = x + barWidth * ratio;
    const insulatorBase = barY - barDepth - 1 * scale;
    const insulatorHeight = 15 * scale;
    ctx.fillStyle = '#192a38';
    ctx.fillRect(insulatorX - 3 * scale, insulatorBase - insulatorHeight, 6 * scale, insulatorHeight);
    for (let rib = 0; rib < 4; rib += 1) {
      const ribY = insulatorBase - insulatorHeight + (rib + 1) * insulatorHeight / 5;
      const ribGradient = ctx.createLinearGradient(insulatorX - 8 * scale, ribY, insulatorX + 8 * scale, ribY);
      ribGradient.addColorStop(0, '#15212d');
      ribGradient.addColorStop(0.45, index === 1 ? '#9bb9c4' : '#829eaa');
      ribGradient.addColorStop(1, '#192632');
      ctx.fillStyle = ribGradient;
      ctx.beginPath();
      ctx.ellipse(insulatorX, ribY, 8 * scale, 2.3 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    anchors.push([insulatorX, insulatorBase - insulatorHeight]);
  });

  ctx.strokeStyle = 'rgba(162, 178, 185, 0.55)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(x - 58 * scale, bottom - 14 * scale);
  ctx.lineTo(x - 10 * scale, barY + 9 * scale);
  ctx.moveTo(x + 62 * scale, bottom - 22 * scale);
  ctx.lineTo(x + 16 * scale, barY + 9 * scale);
  ctx.stroke();

  ctx.fillStyle = 'rgba(149, 179, 193, 0.35)';
  ctx.fillRect(x - poleWidth * 0.7, top + (bottom - top) * 0.76, poleWidth * 1.8, 3 * scale);
  return { anchors, barY, armLeft, armRight };
}

function drawJagged(ctx: CanvasRenderingContext2D, start: [number, number], end: [number, number], seed: number, amplitude: number, width: number, color: string, blur: number, alpha: number) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const steps = Math.max(4, Math.round(length / 25));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const displacement = (randomAt(seed, index) - 0.5) * amplitude * Math.sin(Math.PI * t);
    ctx.lineTo(start[0] + dx * t + nx * displacement, start[1] + dy * t + ny * displacement);
  }
  ctx.lineTo(end[0], end[1]);
  ctx.stroke();
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number, time: number) {
  const w = width;
  const h = height;
  const groundY = h * 0.77;
  const horizonY = h * 0.58;
  ctx.clearRect(0, 0, w, h);

  const skyGlow = ctx.createRadialGradient(w * 0.52, h * 0.37, 10, w * 0.52, h * 0.37, w * 0.72);
  skyGlow.addColorStop(0, 'rgba(22, 99, 155, 0.2)');
  skyGlow.addColorStop(0.56, 'rgba(8, 39, 77, 0.12)');
  skyGlow.addColorStop(1, 'rgba(2, 8, 17, 0)');
  ctx.fillStyle = skyGlow;
  ctx.fillRect(0, 0, w, h);

  const horizon = ctx.createLinearGradient(0, horizonY, 0, h);
  horizon.addColorStop(0, 'rgba(13, 31, 45, 0.34)');
  horizon.addColorStop(0.14, 'rgba(8, 22, 28, 0.72)');
  horizon.addColorStop(1, 'rgba(2, 8, 13, 0.94)');
  polygon(ctx, [[0, horizonY], [w, horizonY], [w, h], [0, h]], horizon);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#5595a7';
  ctx.lineWidth = 1;
  for (let row = 1; row <= 5; row += 1) {
    const y = horizonY + ((h - horizonY) * row * row) / 36;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let column = -5; column <= 5; column += 1) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5 + column * 7, horizonY);
    ctx.lineTo(w * (0.5 + column * 0.2), h);
    ctx.stroke();
  }
  ctx.restore();

  const far = drawPole(ctx, w * 0.77, h * 0.29, h * 0.68, 0.68);
  const near = drawPole(ctx, w * 0.25, h * 0.18, h * 0.78, 1.06);

  const wires: Array<{ start: [number, number]; end: [number, number]; sag: number; index: number }> = [];
  near.anchors.forEach((start, index) => {
    const end = far.anchors[index];
    wires.push({ start, end, sag: h * (0.038 + index * 0.003), index });
  });
  const wirePoint = (wire: typeof wires[number], t: number): [number, number] => [
    wire.start[0] + (wire.end[0] - wire.start[0]) * t,
    wire.start[1] + (wire.end[1] - wire.start[1]) * t + Math.sin(Math.PI * t) * wire.sag,
  ];
  const snapped = smoothRange(progress, 0.23, 0.38);
  const fall = smoothRange(progress, 0.37, 0.58);
  const wirePointOnSurface = (wire: typeof wires[number], t: number): [number, number] => {
    const [x, baseY] = wirePoint(wire, t);
    const drop = wire.index === 1 ? fall * Math.sin(Math.PI * t) * Math.max(0, groundY - wirePoint(wire, 0.5)[1]) : 0;
    return [x, baseY + drop];
  };
  wires.forEach((wire) => {
    const wireSnap = wire.index === 1 ? snapped : 0;
    const gapT = (wireSnap * 20) / Math.max(1, Math.abs(wire.end[0] - wire.start[0])) / 2;
    const segments: Array<[number, number]> = wireSnap > 0.02 ? [[0, 0.5 - gapT], [0.5 + gapT, 1]] : [[0, 1]];
    segments.forEach(([from, to]) => {
      ctx.beginPath();
      const steps = 32;
      for (let index = 0; index <= steps; index += 1) {
        const t = from + (to - from) * index / steps;
        const [x, y] = wirePointOnSurface(wire, t);
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const fallenConductor = wire.index === 1 && wireSnap > 0.02;
      ctx.strokeStyle = 'rgba(5, 11, 17, 0.92)';
      ctx.lineWidth = fallenConductor ? 8.5 : 4.2 * (wire.index === 1 ? 1 : 0.78);
      ctx.stroke();
      ctx.strokeStyle = fallenConductor ? 'rgba(92, 202, 233, 0.96)' : 'rgba(161, 184, 195, 0.72)';
      ctx.lineWidth = fallenConductor ? 5.2 : 1.05;
      if (fallenConductor) {
        ctx.shadowColor = '#52dfff';
        ctx.shadowBlur = 9 + fall * 7;
      }
      ctx.stroke();
      if (fallenConductor) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(231, 251, 255, 0.96)';
        ctx.lineWidth = 1.65;
        ctx.stroke();
      }
      if (wireSnap > 0.08 && wire.index === 1) {
        const tipT = to < 0.5 ? to : from;
        const [tipX, tipY] = wirePointOnSurface(wire, tipT);
        const contact = fall * smoothRange(progress, 0.52, 0.62);
        ctx.save();
        ctx.globalAlpha = 0.45 + contact * 0.55;
        ctx.fillStyle = '#d9ffff';
        ctx.shadowColor = '#49dbff';
        ctx.shadowBlur = 12 + contact * 18;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 2.2 + contact * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    const flowFade = 1 - smoothRange(progress, 0.3, 0.43);
    for (let pulseIndex = 0; pulseIndex < 4; pulseIndex += 1) {
      const t = (time * 0.00019 + progress * 1.1 + wire.index * 0.29 + pulseIndex * 0.24) % 1;
      if (flowFade > 0.01 && !(snapped > 0.05 && t > 0.48 - 0.025 && t < 0.52 + 0.025)) {
        const [x, y] = wirePoint(wire, t);
        const pulse = 0.76 + Math.sin(time * 0.018 + wire.index + pulseIndex) * 0.2;
        ctx.save();
        ctx.globalAlpha = flowFade * pulse;
        ctx.shadowColor = '#58dfff';
        ctx.shadowBlur = 19;
        ctx.fillStyle = pulseIndex === 0 ? '#efffff' : '#74eaff';
        ctx.beginPath();
        ctx.ellipse(x, y, 4.4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const tail = wirePoint(wire, Math.max(0, t - 0.045));
        drawJagged(ctx, tail, [x, y], 100 + wire.index * 5 + pulseIndex, 1.8, 1.5, '#39c8ff', 10, flowFade * 0.52);
      }
    }
  });

  const brokenWire = wires[1];
  const [breakX, breakY] = wirePoint(brokenWire, 0.5);
  const impactX = w * 0.53;
  const fallingX = breakX + (impactX - breakX) * fall + Math.sin(progress * 24) * 15 * fall;
  const fallingY = breakY + (groundY - breakY) * fall;
  const flicker = 0.68 + 0.32 * Math.sin(time * 0.027);

  if (progress > 0.28 && progress < 0.72) {
    const alpha = clamp01((progress - 0.28) / 0.08) * (1 - smoothRange(progress, 0.64, 0.73));
    drawJagged(ctx, [breakX, breakY], [fallingX, fallingY], 41, 30 * flicker, 20, '#167dff', 28, alpha * 0.36);
    drawJagged(ctx, [breakX, breakY], [fallingX, fallingY], 41, 28 * flicker, 7, '#41cfff', 14, alpha * 0.82);
    drawJagged(ctx, [breakX, breakY], [fallingX, fallingY], 41, 24 * flicker, 2, '#e2fdff', 4, alpha);
    for (let branch = 0; branch < 6; branch += 1) {
      const t = 0.24 + branch * 0.11;
      const from: [number, number] = [breakX + (fallingX - breakX) * t, breakY + (fallingY - breakY) * t];
      const dir = randomAt(29, branch) > 0.5 ? 1 : -1;
      const reach = (26 + randomAt(39, branch) * 74) * flicker;
      const to: [number, number] = [from[0] + dir * reach, from[1] + reach * (0.4 + randomAt(52, branch) * 0.5)];
      drawJagged(ctx, from, to, 70 + branch, 17, 1.3, '#baf4ff', 7, alpha * 0.8);
    }
  }

  const groundImpact = smoothRange(progress, 0.55, 0.69) * (1 - smoothRange(progress, 0.88, 0.98));
  if (groundImpact > 0.005) {
    const pulse = 0.8 + Math.sin(time * 0.024) * 0.2;
    const radius = 34 + smoothRange(progress, 0.55, 0.78) * 98;
    const flare = ctx.createRadialGradient(impactX, groundY - 2, 1, impactX, groundY - 2, radius * 1.75);
    flare.addColorStop(0, `rgba(211, 250, 255, ${groundImpact * pulse * 0.96})`);
    flare.addColorStop(0.16, `rgba(44, 184, 255, ${groundImpact * pulse * 0.65})`);
    flare.addColorStop(1, 'rgba(22, 119, 255, 0)');
    ctx.fillStyle = flare;
    ctx.fillRect(impactX - radius * 2, groundY - radius * 1.5, radius * 4, radius * 3);

    ctx.save();
    ctx.globalAlpha = groundImpact * 0.65;
    ctx.strokeStyle = '#6feaff';
    ctx.lineWidth = 1.2;
    for (let ring = 0; ring < 3; ring += 1) {
      const ringProgress = (progress * 5 + ring * 0.33) % 1;
      ctx.globalAlpha = groundImpact * (1 - ringProgress) * 0.55;
      ctx.beginPath();
      ctx.ellipse(impactX, groundY + 2, 18 + ringProgress * 160, 4 + ringProgress * 22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const groundFade = groundImpact * (1 - smoothRange(progress, 0.85, 0.97));
    for (let ray = 0; ray < 22; ray += 1) {
      const angle = (randomAt(81, ray) - 0.5) * Math.PI * 0.92;
      const length = (28 + randomAt(99, ray) * 230) * (0.45 + groundImpact * 0.8);
      const end: [number, number] = [impactX + Math.cos(angle) * length, groundY + Math.sin(angle) * length * 0.18];
      const start: [number, number] = [impactX + (randomAt(15, ray) - 0.5) * 8, groundY + (randomAt(17, ray) - 0.5) * 5];
      drawJagged(ctx, start, end, 170 + ray, 8 + randomAt(38, ray) * 14, 1.2, '#6ddfff', 9, groundFade * 0.7);
      if (ray % 4 === 0) drawJagged(ctx, start, end, 170 + ray, 7, 0.55, '#e4fdff', 3, groundFade * 0.8);
    }

    for (let spark = 0; spark < 48; spark += 1) {
      const phase = time * 0.018 + spark * 2.37;
      const flicker = Math.max(0, Math.sin(phase));
      const direction = randomAt(206, spark) > 0.5 ? 1 : -1;
      const travel = (18 + randomAt(208, spark) * 108) * groundImpact * flicker;
      const x = impactX + direction * travel + (randomAt(210, spark) - 0.5) * 34;
      const y = groundY - randomAt(212, spark) * (8 + travel * 0.26);
      const radius = 0.7 + randomAt(214, spark) * 1.65;
      ctx.save();
      ctx.globalAlpha = groundFade * flicker * (spark % 5 === 0 ? 0.95 : 0.68);
      ctx.fillStyle = spark % 5 === 0 ? '#f1ffff' : spark % 2 === 0 ? '#7beaff' : '#35bdff';
      ctx.shadowColor = '#62e9ff';
      ctx.shadowBlur = 7 + radius * 3;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const surfaceReach = smoothRange(progress, 0.62, 0.81);
  const shieldReveal = smoothRange(progress, 0.78, 0.88);
  const surfaceFade = 1 - smoothRange(progress, 0.86, 0.95);
  const shieldX = impactX;
  if (surfaceReach > 0.005) {
    // Ground potential spreads outward from the contact point in flattened, perspective rings.
    for (let wave = 0; wave < 5; wave += 1) {
      const phase = (time * 0.0001 + wave * 0.2) % 1;
      const radiusX = 18 + phase * w * 0.37 * surfaceReach;
      const radiusY = 3 + phase * h * 0.095 * surfaceReach;
      ctx.save();
      ctx.globalAlpha = surfaceReach * surfaceFade * (1 - phase) * 0.82;
      ctx.strokeStyle = wave % 2 === 0 ? '#53dfff' : '#a6f8ff';
      ctx.lineWidth = wave === 0 ? 1.7 : 1.1;
      ctx.shadowColor = '#39cfff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(impactX, groundY + 3, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (let pulseIndex = 0; pulseIndex < 18; pulseIndex += 1) {
      const angle = pulseIndex * (Math.PI * 2 / 18) + time * 0.00018;
      const travel = (time * 0.00012 + pulseIndex * 0.057) % 1;
      const distance = (18 + travel * w * 0.34) * surfaceReach;
      const x = impactX + Math.cos(angle) * distance;
      const y = groundY + Math.sin(angle) * distance * 0.17;
      ctx.save();
      ctx.globalAlpha = surfaceFade * (0.42 + 0.58 * Math.sin(time * 0.018 + pulseIndex));
      ctx.fillStyle = pulseIndex % 4 === 0 ? '#f1ffff' : '#68eaff';
      ctx.shadowColor = '#4cddff';
      ctx.shadowBlur = 13;
      ctx.beginPath();
      ctx.ellipse(x, y, 3.4, 1.8, angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (shieldReveal > 0.005) {
      const barrierGlow = shieldReveal * (0.65 + 0.35 * Math.sin(time * 0.025));
      ctx.save();
      ctx.strokeStyle = `rgba(170, 255, 255, ${barrierGlow * 0.78})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#46e9ff';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.ellipse(shieldX, groundY + 3, 32 + shieldReveal * 42, 8 + shieldReveal * 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (let spark = 0; spark < 12; spark += 1) {
        const phase = time * 0.02 + spark * 1.91;
        const side = randomAt(415, spark) > 0.5 ? 1 : -1;
        const x = shieldX + side * (8 + randomAt(417, spark) * 24) * Math.max(0.35, Math.sin(phase));
        const y = groundY - 10 - randomAt(419, spark) * 64;
        ctx.save();
        ctx.globalAlpha = barrierGlow * Math.max(0, Math.sin(phase));
        ctx.fillStyle = spark % 3 === 0 ? '#f4ffff' : '#69eeff';
        ctx.shadowColor = '#50e6ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, 1 + randomAt(421, spark) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

export function TelemetryIntroSequence() {
  const sequenceRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const sequence = sequenceRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!sequence || !canvas || !ctx) return;

    let animationFrame = 0;
    let progressFrame = 0;
    let visible = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pixelWidth = 0;
    let pixelHeight = 0;
    let pixelRatio = 1;

    const drawFrame = (time: number) => {
      animationFrame = 0;
      const rect = canvas.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(rect.width * pixelRatio));
      const nextHeight = Math.max(1, Math.round(rect.height * pixelRatio));
      if (nextWidth !== pixelWidth || nextHeight !== pixelHeight) {
        pixelWidth = nextWidth;
        pixelHeight = nextHeight;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawScene(ctx, rect.width, rect.height, progressRef.current, time);
      if (visible && !reducedMotion) animationFrame = window.requestAnimationFrame(drawFrame);
    };
    const requestDraw = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(drawFrame);
    };

    const updateProgress = () => {
      const navHeight = document.querySelector<HTMLElement>('.app-topbar')?.getBoundingClientRect().height ?? 68;
      sequence.style.setProperty('--nav-height', `${navHeight}px`);
      const travel = Math.max(1, sequence.offsetHeight - (window.innerHeight - navHeight));
      const distance = navHeight - sequence.getBoundingClientRect().top;
      const progress = clamp01(distance / travel);
      progressRef.current = progress;
      sequence.style.setProperty('--scene-progress', `${progress}`);
      const mark = smoothRange(progress, 0.79, 0.89);
      sequence.style.setProperty('--safety-mark-opacity', `${mark}`);
      sequence.style.setProperty('--safety-mark-scale', `${0.8 + mark * 0.2}`);
      sequence.style.setProperty('--safety-mark-y', `${(1 - mark) * 34}px`);
      sequence.style.setProperty('--safety-slash-progress', `${smoothRange(progress, 0.83, 0.9)}`);
    };

    const scheduleProgress = () => {
      if (progressFrame) window.cancelAnimationFrame(progressFrame);
      progressFrame = window.requestAnimationFrame(() => {
        progressFrame = 0;
        updateProgress();
        if (reducedMotion) drawFrame(performance.now());
      });
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestDraw();
      else if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }, { rootMargin: '120px 0px' });
    observer.observe(sequence);
    updateProgress();
    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', scheduleProgress);

    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (progressFrame) window.cancelAnimationFrame(progressFrame);
      window.removeEventListener('scroll', scheduleProgress);
      window.removeEventListener('resize', scheduleProgress);
    };
  }, []);

  return (
    <section className="telemetry-scene-sequence" ref={sequenceRef} aria-label="SafeNetQ power line safety sequence">
      <div className="telemetry-scene-pin">
        <canvas className="telemetry-scene-canvas" ref={canvasRef} aria-hidden="true" />
        <div className="telemetry-scene-clouds" aria-hidden="true" />
        <div className="telemetry-scene-safety-mark" aria-hidden="true">
          <ZapOff size={108} strokeWidth={1.25} />
          <span className="telemetry-scene-safety-slash" />
        </div>
        <div className="telemetry-scene-cue" aria-hidden="true">
          <span>SCROLL TO FOLLOW THE CURRENT</span>
          <i />
        </div>
      </div>
    </section>
  );
}

export function TelemetryTitleReveal() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const updateStamp = () => {
      frame = 0;
      if (reducedMotion) {
        section.style.setProperty('--title-opacity', '1');
        section.style.setProperty('--title-scale', '1');
        section.style.setProperty('--title-y', '0px');
        section.style.setProperty('--title-rotate', '0deg');
        section.style.setProperty('--title-glow', '24px');
        return;
      }

      const rect = section.getBoundingClientRect();
      const progress = clamp01((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
      const stamp = smoothRange(progress, 0.08, 0.5);
      const settle = smoothRange(progress, 0.5, 0.79);
      const opacity = smoothRange(progress, 0.04, 0.25);
      const scale = 0.32 + stamp * 0.9 - settle * 0.2;
      const y = -150 * (1 - stamp) + 8 * (1 - settle);
      const rotate = -24 * (1 - stamp) + 2.5 * (1 - settle);
      const glow = 64 - settle * 42;

      section.style.setProperty('--title-opacity', `${opacity}`);
      section.style.setProperty('--title-scale', `${scale}`);
      section.style.setProperty('--title-y', `${y}px`);
      section.style.setProperty('--title-rotate', `${rotate}deg`);
      section.style.setProperty('--title-glow', `${glow}px`);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateStamp);
    };

    updateStamp();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  return (
    <section className="telemetry-title-reveal" ref={sectionRef} aria-labelledby="telemetry-title-heading">
      <div className="telemetry-title-reveal__pin">
        <svg className="telemetry-title-reveal__filters" aria-hidden="true" focusable="false">
          <defs>
            <filter id="kinetic-flowfield" x="-16%" y="-26%" width="132%" height="152%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.01 0.04" numOctaves="1" seed="7" result="flow-noise">
                <animate attributeName="baseFrequency" values="0.009 0.035;0.014 0.062;0.01 0.042;0.009 0.035" dur="3s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="flow-noise" scale="27" xChannelSelector="R" yChannelSelector="G">
                <animate attributeName="scale" values="18;34;22;31;18" dur="2.7s" repeatCount="indefinite" />
              </feDisplacementMap>
            </filter>
          </defs>
        </svg>
        <div className="telemetry-title-reveal__copy">
          <h1 className="telemetry-title-reveal__heading" id="telemetry-title-heading" data-text="SafeNetQ">
            SafeNetQ
          </h1>
          <p className="telemetry-title-reveal__subtitle">
            Real-Time Monitoring and Relay-Based Protection for Power Distribution Systems Using Adaptive Baseline Learning
          </p>
        </div>
        <a className="telemetry-title-reveal__continue" href="#telemetry-views" aria-label="Continue to dashboard views">CONTINUE TO TELEMETRY</a>
      </div>
    </section>
  );
}
