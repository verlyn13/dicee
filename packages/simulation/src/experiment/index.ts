/**
 * Experiment Framework
 *
 * Scientific experiment execution, statistical analysis, and hypothesis testing.
 *
 * @example
 * import {
 *   ExperimentRunner,
 *   runCalibrationExperiment,
 *   calculateDescriptiveStats,
 *   oneSampleTTest,
 * } from '@dicee/simulation/experiment';
 */

// Statistics exports
export {
	mean,
	median,
	variance,
	standardDeviation,
	standardError,
	percentile,
	confidenceInterval,
	confidenceIntervalWidth,
	calculateDescriptiveStats,
	cohensD,
	pooledStandardDeviation,
	interpretEffectSize,
	sampleSizeOneSampleTTest,
	sampleSizeTwoSampleTTest,
	sampleSizeProportionTest,
	sampleSizeForCIWidth,
	getCriticalT,
	tStatisticOneSample,
	tStatisticTwoSample,
	tStatisticWelch,
	welchDF,
	approximatePValue,
	chiSquare2x2,
	chiSquarePValue1DF,
} from './statistics.js';

// Hypothesis testing exports
export {
	oneSampleTTest,
	twoSampleTTest,
	welchTTest,
	chiSquareTest,
	rangeTest,
	testHypothesis,
	bonferroniCorrection,
} from './hypothesis.js';

// Runner exports
export {
	ExperimentRunner,
	runCalibrationExperiment,
	runQuickExperiment,
	type ExperimentProgress,
	type ExperimentProgressCallback,
} from './runner.js';
