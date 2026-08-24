import { NotEnoughDataError, computeMetrics, fitOls, predict } from './ols';

describe('fitOls', () => {
  it('recovers the exact coefficients of a noise-free linear relationship', () => {
    // y = 5 + 2*x1 - 3*x2
    const x = [
      [1, 0],
      [2, 1],
      [3, 2],
      [0, 1],
      [4, 4],
      [5, 1],
      [2, 3],
    ];
    const y = x.map(([a, b]) => 5 + 2 * a - 3 * b);

    const model = fitOls(x, y);

    expect(model.intercept).toBeCloseTo(5, 6);
    expect(model.coefficients[0]).toBeCloseTo(2, 6);
    expect(model.coefficients[1]).toBeCloseTo(-3, 6);
    expect(model.metrics.rSquared).toBeCloseTo(1, 6);
    expect(model.metrics.mae).toBeCloseTo(0, 6);
    expect(model.degenerate).toBe(false);
    expect(model.regularized).toBe(false);
  });

  it('recovers a known simple-regression slope and intercept', () => {
    // Classic worked example: y = 1 + 0.5x over evenly spaced x.
    const x = [[0], [2], [4], [6], [8], [10]];
    const y = [1, 2, 3, 4, 5, 6];

    const model = fitOls(x, y);

    expect(model.intercept).toBeCloseTo(1, 9);
    expect(model.coefficients[0]).toBeCloseTo(0.5, 9);
  });

  it('fits a sensible line through noisy data', () => {
    const x = [[1], [2], [3], [4], [5], [6], [7], [8]];
    const y = [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1];

    const model = fitOls(x, y);

    expect(model.coefficients[0]).toBeCloseTo(2, 1);
    expect(model.metrics.rSquared).toBeGreaterThan(0.99);
    expect(model.metrics.rmse).toBeLessThan(0.5);
  });

  it('falls back to ridge when a feature is perfectly collinear', () => {
    // x2 is exactly 2*x1, so XtX is singular.
    const x = [
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
      [5, 10],
      [6, 12],
    ];
    const y = [3, 6, 9, 12, 15, 18];

    const model = fitOls(x, y);

    expect(model.regularized).toBe(true);
    expect(Number.isFinite(model.intercept)).toBe(true);
    expect(model.coefficients.every((c) => Number.isFinite(c))).toBe(true);
    // Ridge splits the shared slope between the two collinear columns, but
    // the fitted surface must still track the data.
    expect(predict(model, [3, 6])).toBeCloseTo(9, 0);
  });

  it('still predicts near the mean when every feature is constant', () => {
    // A constant column is collinear with the intercept, so the plain normal
    // equations are singular. Ridge resolves it by splitting the level
    // between the two, which is why the prediction is very slightly shrunk
    // toward zero rather than exactly the mean.
    const x = [[1], [1], [1], [1], [1]];
    const y = [10, 20, 30, 40, 50];

    const model = fitOls(x, y);

    expect(model.regularized).toBe(true);
    expect(model.degenerate).toBe(false);
    expect(predict(model, [1])).toBeCloseTo(30, 1);
    expect(Number.isNaN(model.metrics.rSquared)).toBe(false);
  });

  it('degenerates to the mean instead of emitting NaN when the data is not numerically solvable', () => {
    const x = [[1], [2], [Number.NaN], [4], [5], [6]];
    const y = [10, 20, 30, 40, 50, 60];

    const model = fitOls(x, y);

    expect(model.degenerate).toBe(true);
    expect(model.intercept).toBeCloseTo(35, 9);
    expect(predict(model, [3])).toBeCloseTo(35, 9);
    expect(model.coefficients.every(Number.isFinite)).toBe(true);
  });

  it('reports R-squared of 0, not 1, when the target never varies', () => {
    const x = [[1], [2], [3], [4], [5]];
    const y = [7, 7, 7, 7, 7];

    const model = fitOls(x, y);

    expect(model.metrics.rSquared).toBe(0);
    expect(predict(model, [3])).toBeCloseTo(7, 6);
  });

  it('refuses to fit when there are too few observations to have any freedom', () => {
    // 2 features needs at least 4 rows; 3 is an over-determined fit that would
    // look perfect and predict nothing.
    expect(() =>
      fitOls(
        [
          [1, 2],
          [2, 3],
          [3, 4],
        ],
        [1, 2, 3],
      ),
    ).toThrow(NotEnoughDataError);
  });

  it('rejects mismatched input lengths', () => {
    expect(() => fitOls([[1], [2]], [1])).toThrow(/disagree/);
  });

  it('rejects ragged design matrices', () => {
    expect(() =>
      fitOls([[1, 2], [3], [4, 5], [6, 7], [8, 9]], [1, 2, 3, 4, 5]),
    ).toThrow(/same width/);
  });
});

describe('predict', () => {
  it('rejects a feature vector of the wrong width', () => {
    const model = fitOls([[1], [2], [3], [4]], [1, 2, 3, 4]);
    expect(() => predict(model, [1, 2])).toThrow(/expects 1 features/);
  });
});

describe('computeMetrics', () => {
  it('computes MAE and RMSE from known residuals', () => {
    // Residuals: +1, -1, +2, -2 -> MAE 1.5, RMSE sqrt(10/4)
    const actual = [10, 10, 10, 10];
    const predicted = [9, 11, 8, 12];

    const metrics = computeMetrics(actual, predicted, 1);

    expect(metrics.mae).toBeCloseTo(1.5, 9);
    expect(metrics.rmse).toBeCloseTo(Math.sqrt(2.5), 9);
    expect(metrics.sampleCount).toBe(4);
  });
});
