import { spawn } from 'node:child_process';

const CROP_TIGHTNESS = 0.86;
const SMOOTHING_ALPHA = 0.35;
const MAX_STEP_RATIO = 0.12;
const MERGE_EPSILON_RATIO = 0.01;

export function detectFaceTrack({ pythonPath, scriptPath, videoPath }) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [scriptPath, videoPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`face detection failed: ${stderr.slice(-800)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`face detection returned invalid output: ${stdout.slice(-400)}`));
      }
    });
  });
}

export function buildReframePlan({ sourceWidth, sourceHeight, track }) {
  if (!Array.isArray(track) || track.length < 2) return null;

  const anyFound = track.some(point => point.found);
  if (!anyFound) return null;

  const cropWidth = even(sourceWidth * CROP_TIGHTNESS);
  const cropHeight = even(sourceHeight * CROP_TIGHTNESS);
  const maxX = sourceWidth - cropWidth;
  const maxY = sourceHeight - cropHeight;

  const filled = fillGaps(track, sourceWidth, sourceHeight);
  const smoothed = smooth(filled);
  const clamped = smoothed.map(point => ({
    t: point.t,
    x: clamp(point.cx - cropWidth / 2, 0, maxX),
    y: clamp(point.cy - cropHeight / 2, 0, maxY)
  }));
  const limited = limitStepSize(clamped, MAX_STEP_RATIO * cropWidth, MAX_STEP_RATIO * cropHeight);
  const merged = mergeNearDuplicates(limited, MERGE_EPSILON_RATIO * cropWidth);

  if (merged.length < 2) return null;

  return {
    cropWidth,
    cropHeight,
    xExpr: buildExpression(merged, 'x'),
    yExpr: buildExpression(merged, 'y')
  };
}

function fillGaps(track, sourceWidth, sourceHeight) {
  let lastKnown = { cx: sourceWidth / 2, cy: sourceHeight / 2 };
  return track.map(point => {
    if (point.found) {
      lastKnown = { cx: point.cx, cy: point.cy };
      return { t: point.t, cx: point.cx, cy: point.cy };
    }
    return { t: point.t, cx: lastKnown.cx, cy: lastKnown.cy };
  });
}

function smooth(points) {
  const result = [];
  let previous = null;
  for (const point of points) {
    if (!previous) {
      result.push(point);
      previous = point;
      continue;
    }
    const cx = previous.cx + SMOOTHING_ALPHA * (point.cx - previous.cx);
    const cy = previous.cy + SMOOTHING_ALPHA * (point.cy - previous.cy);
    const next = { t: point.t, cx, cy };
    result.push(next);
    previous = next;
  }
  return result;
}

function limitStepSize(points, maxStepX, maxStepY) {
  const result = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const previous = result[i - 1];
    const point = points[i];
    const dx = clamp(point.x - previous.x, -maxStepX, maxStepX);
    const dy = clamp(point.y - previous.y, -maxStepY, maxStepY);
    result.push({ t: point.t, x: previous.x + dx, y: previous.y + dy });
  }
  return result;
}

function mergeNearDuplicates(points, epsilon) {
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const previous = result[result.length - 1];
    const point = points[i];
    const moved = Math.abs(point.x - previous.x) > epsilon || Math.abs(point.y - previous.y) > epsilon;
    if (moved) result.push(point);
  }
  result.push(points[points.length - 1]);
  return result;
}

function buildExpression(points, axis) {
  let expr = round1(points[points.length - 1][axis]).toString();
  for (let i = points.length - 2; i >= 0; i -= 1) {
    const from = points[i];
    const to = points[i + 1];
    const span = to.t - from.t || 1;
    const lerp = `(${round1(from[axis])}+(${round1(to[axis])}-${round1(from[axis])})*(t-${from.t})/${span})`;
    expr = `if(lt(t,${to.t}),${lerp},${expr})`;
  }
  return expr;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function even(value) {
  const number = Math.max(2, Math.round(value));
  return number % 2 === 0 ? number : number - 1;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
