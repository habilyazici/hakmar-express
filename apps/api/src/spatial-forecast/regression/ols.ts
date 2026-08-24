/**
 * Ordinary least squares via the normal equations, with a ridge fallback
 * when the design matrix is singular (which happens whenever a feature is
 * constant across the sample — common here for cities with a short or flat
 * history).
 *
 * Deliberately dependency-free: the whole model is ~40 lines of linear
 * algebra on matrices that are at most 6x6, so pulling in a matrix library
 * would cost more than it saves.
 */

export interface OlsMetrics {
  rSquared: number;
  mae: number;
  rmse: number;
  sampleCount: number;
  featureCount: number;
}

export interface OlsModel {
  intercept: number;
  coefficients: number[];
  metrics: OlsMetrics;
  /** True when the normal equations were singular and ridge was applied. */
  regularized: boolean;
  /** True when even ridge failed and the model degenerates to the mean of y. */
  degenerate: boolean;
}

const RIDGE_LAMBDAS = [1e-2, 1, 100];
const PIVOT_EPSILON = 1e-10;

export class NotEnoughDataError extends Error {
  constructor(samples: number, features: number) {
    super(
      `Need at least ${features + 2} observations to fit ${features} features; got ${samples}.`,
    );
    this.name = 'NotEnoughDataError';
  }
}

export function fitOls(x: number[][], y: number[]): OlsModel {
  if (x.length !== y.length) {
    throw new Error(
      `Design matrix and target vector disagree: ${x.length} rows vs ${y.length} targets.`,
    );
  }
  if (x.length === 0 || x[0].length === 0) {
    throw new NotEnoughDataError(x.length, x[0]?.length ?? 0);
  }

  const featureCount = x[0].length;
  if (x.some((row) => row.length !== featureCount)) {
    throw new Error('All rows of the design matrix must have the same width.');
  }
  // An exactly-determined system fits the data perfectly and generalises to
  // nothing; require a couple of degrees of freedom before trusting it.
  if (x.length < featureCount + 2) {
    throw new NotEnoughDataError(x.length, featureCount);
  }

  const design = x.map((row) => [1, ...row]);
  const width = featureCount + 1;

  const xtx = matMulTransposeSelf(design, width);
  const xty = matVecTranspose(design, y, width);

  let inverse = invert(xtx);
  let regularized = false;

  for (const lambda of RIDGE_LAMBDAS) {
    if (inverse) break;
    regularized = true;
    const ridged = xtx.map((row, i) =>
      row.map((v, j) => (i === j ? v + lambda : v)),
    );
    inverse = invert(ridged);
  }

  if (!inverse) {
    return degenerateModel(y, featureCount);
  }

  const beta = new Array<number>(width).fill(0);
  for (let i = 0; i < width; i++) {
    let sum = 0;
    for (let j = 0; j < width; j++) sum += inverse[i][j] * xty[j];
    if (!Number.isFinite(sum)) {
      return degenerateModel(y, featureCount);
    }
    beta[i] = sum;
  }

  const predictions = design.map((row) =>
    row.reduce((acc, value, i) => acc + value * beta[i], 0),
  );

  return {
    intercept: beta[0],
    coefficients: beta.slice(1),
    metrics: computeMetrics(y, predictions, featureCount),
    regularized,
    degenerate: false,
  };
}

export function predict(model: OlsModel, features: number[]): number {
  if (features.length !== model.coefficients.length) {
    throw new Error(
      `Model expects ${model.coefficients.length} features, got ${features.length}.`,
    );
  }
  const value = features.reduce(
    (acc, f, i) => acc + f * model.coefficients[i],
    model.intercept,
  );
  return Number.isFinite(value) ? value : 0;
}

function degenerateModel(y: number[], featureCount: number): OlsModel {
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  const predictions = new Array<number>(y.length).fill(mean);
  return {
    intercept: mean,
    coefficients: new Array<number>(featureCount).fill(0),
    metrics: computeMetrics(y, predictions, featureCount),
    regularized: true,
    degenerate: true,
  };
}

export function computeMetrics(
  actual: number[],
  predicted: number[],
  featureCount: number,
): OlsMetrics {
  const n = actual.length;
  const mean = actual.reduce((a, b) => a + b, 0) / n;

  let sse = 0;
  let sst = 0;
  let absError = 0;
  for (let i = 0; i < n; i++) {
    const error = actual[i] - predicted[i];
    sse += error * error;
    absError += Math.abs(error);
    const centered = actual[i] - mean;
    sst += centered * centered;
  }

  // With a constant target SST is 0 and R² is undefined rather than perfect.
  const rSquared = sst > PIVOT_EPSILON ? 1 - sse / sst : 0;

  return {
    rSquared: Number.isFinite(rSquared) ? rSquared : 0,
    mae: absError / n,
    rmse: Math.sqrt(sse / n),
    sampleCount: n,
    featureCount,
  };
}

/** Computes XᵀX without materialising the transpose. */
function matMulTransposeSelf(design: number[][], width: number): number[][] {
  const out: number[][] = Array.from({ length: width }, () =>
    new Array<number>(width).fill(0),
  );
  for (const row of design) {
    for (let i = 0; i < width; i++) {
      for (let j = i; j < width; j++) {
        out[i][j] += row[i] * row[j];
      }
    }
  }
  // XᵀX is symmetric; mirror the upper triangle rather than recomputing it.
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < i; j++) out[i][j] = out[j][i];
  }
  return out;
}

function matVecTranspose(
  design: number[][],
  y: number[],
  width: number,
): number[] {
  const out = new Array<number>(width).fill(0);
  for (let k = 0; k < design.length; k++) {
    for (let i = 0; i < width; i++) out[i] += design[k][i] * y[k];
  }
  return out;
}

/** Gauss-Jordan inversion; returns null for a singular or numerically unstable matrix. */
function invert(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(aug[pivotRow][col]) < PIVOT_EPSILON) return null;
    [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= factor * aug[col][j];
    }
  }

  const inverse = aug.map((row) => row.slice(n));
  for (const row of inverse) {
    if (row.some((v) => !Number.isFinite(v))) return null;
  }
  return inverse;
}
