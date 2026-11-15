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
  wires.forEach((wire) => {
    const gapT = (snapped * 20) / Math.max(1, Math.abs(wire.end[0] - wire.start[0])) / 2;
    const segments: Array<[number, number]> = snapped > 0.02 ? [[0, 0.5 - gapT], [0.5 + gapT, 1]] : [[0, 1]];
    segments.forEach(([from, to]) => {
      ctx.beginPath();
      const steps = 32;
      for (let index = 0; index <= steps; index += 1) {
        const t = from + (to - from) * index / steps;
        const [x, y] = wirePoint(wire, t);
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(5, 11, 17, 0.92)';
      ctx.lineWidth = 4.2 * (wire.index === 1 ? 1 : 0.78);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(161, 184, 195, 0.62)';
      ctx.lineWidth = 1.05;
      ctx.stroke();
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
  const fall = smoothRange(progress, 0.37, 0.58);
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
  const shieldX = w * 0.71;
  const surfaceEndX = impactX + (shieldX - impactX) * surfaceReach;
  if (surfaceReach > 0.005) {
    const surfaceStart: [number, number] = [impactX, groundY + 1];
    const surfaceEnd: [number, number] = [surfaceEndX, groundY - 7];
    drawJagged(ctx, surfaceStart, surfaceEnd, 313, 4, 16, '#087cff', 27, surfaceReach * surfaceFade * 0.4);
    drawJagged(ctx, surfaceStart, surfaceEnd, 313, 3, 5, '#39dfff', 12, surfaceReach * surfaceFade * 0.88);
    drawJagged(ctx, surfaceStart, surfaceEnd, 313, 2, 1.6, '#e5ffff', 4, surfaceReach * surfaceFade);

    for (let pulseIndex = 0; pulseIndex < 5; pulseIndex += 1) {
      const moving = (time * 0.00024 + pulseIndex * 0.19) % 1;
      const t = Math.min(moving * surfaceReach, Math.max(0, surfaceReach - 0.018));
      const x = impactX + (shieldX - impactX) * t;
      const y = groundY - 7 * t + Math.sin(t * Math.PI * 2 + pulseIndex) * 2;
      ctx.save();
      ctx.globalAlpha = surfaceFade * (0.56 + 0.44 * Math.sin(time * 0.02 + pulseIndex));
      ctx.fillStyle = pulseIndex === 0 ? '#f2ffff' : '#67eaff';
      ctx.shadowColor = '#42dfff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.ellipse(x, y, 5.5, 2.1, -0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (shieldReveal > 0.005) {
      const barrierGlow = shieldReveal * (0.65 + 0.35 * Math.sin(time * 0.025));
      const barrier = ctx.createLinearGradient(shieldX, groundY - 78, shieldX, groundY + 12);
      barrier.addColorStop(0, 'rgba(81, 225, 255, 0)');
      barrier.addColorStop(0.55, `rgba(124, 248, 255, ${barrierGlow * 0.62})`);
      barrier.addColorStop(1, 'rgba(81, 225, 255, 0)');
      ctx.save();
      ctx.strokeStyle = barrier;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#46e9ff';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(shieldX, groundY - 78);
      ctx.lineTo(shieldX, groundY + 10);
      ctx.stroke();
      ctx.strokeStyle = `rgba(170, 255, 255, ${barrierGlow * 0.78})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(shieldX, groundY + 3, 22 + shieldReveal * 44, 5 + shieldReveal * 8, 0, 0, Math.PI * 2);
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
  return (
    <section className="telemetry-title-reveal" aria-labelledby="telemetry-title-heading">
      <svg className="telemetry-title-reveal__filters" aria-hidden="true" focusable="false">
        <defs>
          <filter id="kinetic-flowfield" x="-20%" y="-35%" width="140%" height="170%">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.045" numOctaves="1" seed="7" result="flow-noise">
              <animate attributeName="baseFrequency" values="0.008 0.035;0.015 0.065;0.008 0.035" dur="3.4s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="flow-noise" scale="24" xChannelSelector="R" yChannelSelector="G">
              <animate attributeName="scale" values="8;28;12;24" dur="2.8s" repeatCount="indefinite" />
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
    </section>
  );
}
