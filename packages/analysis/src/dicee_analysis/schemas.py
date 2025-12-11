"""
Pydantic models mirroring TypeScript Zod schemas.

Field names use snake_case per PEP 8, with alias for camelCase JSON interchange.
This ensures compatibility with @dicee/simulation NDJSON output.

Example:
    >>> import json
    >>> from dicee_analysis.schemas import GameResult
    >>> with open("games.ndjson") as f:
    ...     for line in f:
    ...         game = GameResult.model_validate_json(line)
    ...         print(f"Game {game.game_id}: winner={game.winner_id}")
"""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Enums
# =============================================================================


class ProfileId(StrEnum):
    """AI profile identifiers matching TypeScript ProfileIdSchema."""

    RILEY = "riley"
    CARMEN = "carmen"
    LIAM = "liam"
    PROFESSOR = "professor"
    CHARLIE = "charlie"
    CUSTOM = "custom"


class BrainType(StrEnum):
    """Brain type identifiers matching TypeScript BrainTypeSchema."""

    OPTIMAL = "optimal"
    PROBABILISTIC = "probabilistic"
    PERSONALITY = "personality"
    RANDOM = "random"
    LLM = "llm"


class ExperimentType(StrEnum):
    """Experiment type identifiers matching TypeScript ExperimentTypeSchema."""

    CALIBRATION = "CALIBRATION"
    DECISION_QUALITY = "DECISION_QUALITY"
    HEAD_TO_HEAD = "HEAD_TO_HEAD"
    TRAIT_SENSITIVITY = "TRAIT_SENSITIVITY"
    REGRESSION = "REGRESSION"
    ABLATION = "ABLATION"


class StoppingRuleType(StrEnum):
    """Stopping rule types."""

    FIXED = "FIXED"
    SEQUENTIAL = "SEQUENTIAL"
    ADAPTIVE = "ADAPTIVE"


class EffectInterpretation(StrEnum):
    """Effect size interpretation categories."""

    NEGLIGIBLE = "negligible"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    VERY_LARGE = "very_large"


# =============================================================================
# Scorecard Model
# =============================================================================


class Scorecard(BaseModel):
    """Scorecard state matching TypeScript ScorecardSchema."""

    model_config = ConfigDict(populate_by_name=True)

    ones: int | None = None
    twos: int | None = None
    threes: int | None = None
    fours: int | None = None
    fives: int | None = None
    sixes: int | None = None
    three_of_a_kind: int | None = Field(None, alias="threeOfAKind")
    four_of_a_kind: int | None = Field(None, alias="fourOfAKind")
    full_house: int | None = Field(None, alias="fullHouse")
    small_straight: int | None = Field(None, alias="smallStraight")
    large_straight: int | None = Field(None, alias="largeStraight")
    dicee: int | None = None
    chance: int | None = None

    @property
    def upper_section_score(self) -> int:
        """Calculate upper section total."""
        return sum(
            v or 0
            for v in [self.ones, self.twos, self.threes, self.fours, self.fives, self.sixes]
        )

    @property
    def lower_section_score(self) -> int:
        """Calculate lower section total."""
        return sum(
            v or 0
            for v in [
                self.three_of_a_kind,
                self.four_of_a_kind,
                self.full_house,
                self.small_straight,
                self.large_straight,
                self.dicee,
                self.chance,
            ]
        )

    @property
    def upper_bonus(self) -> bool:
        """Check if upper bonus threshold (63) is met."""
        return self.upper_section_score >= 63


# =============================================================================
# Result Models
# =============================================================================


class PlayerResult(BaseModel):
    """Result for a single player in a game."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    profile_id: str = Field(alias="profileId")
    final_score: int = Field(alias="finalScore", ge=0)
    scorecard: Scorecard
    upper_bonus: bool = Field(alias="upperBonus")
    dicee_count: int = Field(alias="diceeCount", ge=0)
    optimal_decisions: int | None = Field(None, alias="optimalDecisions")
    total_decisions: int | None = Field(None, alias="totalDecisions")
    ev_loss: float | None = Field(None, alias="evLoss")


class GameResult(BaseModel):
    """Complete result for a single game."""

    model_config = ConfigDict(populate_by_name=True)

    game_id: str = Field(alias="gameId")
    seed: int
    experiment_id: str | None = Field(None, alias="experimentId")
    started_at: datetime = Field(alias="startedAt")
    completed_at: datetime = Field(alias="completedAt")
    duration_ms: int = Field(alias="durationMs", ge=0)
    players: list[PlayerResult]
    winner_id: str = Field(alias="winnerId")
    winner_profile_id: str = Field(alias="winnerProfileId")

    def get_player(self, player_id: str) -> PlayerResult | None:
        """Get player result by ID."""
        return next((p for p in self.players if p.id == player_id), None)

    def get_player_by_profile(self, profile_id: str) -> PlayerResult | None:
        """Get player result by profile ID."""
        return next((p for p in self.players if p.profile_id == profile_id), None)


class TurnResult(BaseModel):
    """Result for a single turn."""

    model_config = ConfigDict(populate_by_name=True)

    turn_id: str = Field(alias="turnId")
    game_id: str = Field(alias="gameId")
    player_id: str = Field(alias="playerId")
    profile_id: str = Field(alias="profileId")
    turn_number: int = Field(alias="turnNumber", ge=1, le=13)
    roll_count: int = Field(alias="rollCount", ge=1, le=3)
    final_dice: tuple[int, int, int, int, int] = Field(alias="finalDice")
    scored_category: str = Field(alias="scoredCategory")
    scored_points: int = Field(alias="scoredPoints", ge=0)
    optimal_category: str | None = Field(None, alias="optimalCategory")
    optimal_points: int | None = Field(None, alias="optimalPoints")
    ev_difference: float | None = Field(None, alias="evDifference")
    was_optimal: bool | None = Field(None, alias="wasOptimal")


class DecisionResult(BaseModel):
    """Result for a dice-keeping decision."""

    model_config = ConfigDict(populate_by_name=True)

    decision_id: str = Field(alias="decisionId")
    turn_id: str = Field(alias="turnId")
    game_id: str = Field(alias="gameId")
    player_id: str = Field(alias="playerId")
    roll_number: int = Field(alias="rollNumber", ge=1, le=3)
    dice_before: tuple[int, int, int, int, int] = Field(alias="diceBefore")
    dice_after: tuple[int, int, int, int, int] = Field(alias="diceAfter")
    kept_mask: tuple[bool, bool, bool, bool, bool] = Field(alias="keptMask")
    was_optimal_hold: bool | None = Field(None, alias="wasOptimalHold")
    ev_loss: float | None = Field(None, alias="evLoss")


# =============================================================================
# Statistical Models
# =============================================================================


class DescriptiveStats(BaseModel):
    """Descriptive statistics for a metric."""

    model_config = ConfigDict(populate_by_name=True)

    n: int = Field(ge=0)
    mean: float
    median: float
    std_dev: float = Field(alias="stdDev", ge=0)
    min: float
    max: float
    q1: float
    q3: float
    ci95_lower: float = Field(alias="ci95Lower")
    ci95_upper: float = Field(alias="ci95Upper")

    @property
    def iqr(self) -> float:
        """Interquartile range."""
        return self.q3 - self.q1

    @property
    def ci_width(self) -> float:
        """Width of 95% confidence interval."""
        return self.ci95_upper - self.ci95_lower


class HypothesisTestResult(BaseModel):
    """Result of a statistical hypothesis test."""

    model_config = ConfigDict(populate_by_name=True)

    hypothesis_id: str = Field(alias="hypothesisId")
    rejected: bool
    p_value: float = Field(alias="pValue", ge=0, le=1)
    test_statistic: float = Field(alias="testStatistic")
    effect_size: float = Field(alias="effectSize")
    effect_interpretation: EffectInterpretation = Field(alias="effectInterpretation")
    sample_size: int = Field(alias="sampleSize", gt=0)
    conclusion: str


class ExperimentResults(BaseModel):
    """Complete results from an experiment run."""

    model_config = ConfigDict(populate_by_name=True)

    experiment_id: str = Field(alias="experimentId")
    experiment_version: str = Field(alias="experimentVersion")
    started_at: datetime = Field(alias="startedAt")
    completed_at: datetime = Field(alias="completedAt")
    total_games: int = Field(alias="totalGames", ge=0)
    duration_ms: int = Field(alias="durationMs", ge=0)
    master_seed: int | None = Field(None, alias="masterSeed")
    stats_by_profile: dict[str, dict[str, DescriptiveStats]] = Field(alias="statsByProfile")
    hypothesis_results: list[HypothesisTestResult] = Field(alias="hypothesisResults")
    all_hypotheses_passed: bool = Field(alias="allHypothesesPassed")
    summary: str


# =============================================================================
# Validators / Parsers
# =============================================================================


def parse_game_result(data: dict[str, Any]) -> GameResult:
    """Parse and validate game result from JSON dict."""
    return GameResult.model_validate(data)


def parse_turn_result(data: dict[str, Any]) -> TurnResult:
    """Parse and validate turn result from JSON dict."""
    return TurnResult.model_validate(data)


def parse_decision_result(data: dict[str, Any]) -> DecisionResult:
    """Parse and validate decision result from JSON dict."""
    return DecisionResult.model_validate(data)


def parse_experiment_results(data: dict[str, Any]) -> ExperimentResults:
    """Parse and validate experiment results from JSON dict."""
    return ExperimentResults.model_validate(data)
