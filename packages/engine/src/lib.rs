mod probability;
mod scoring;
mod types;

use types::{parse_dice, Category, CategoryInfo, ScoringResult};
use wasm_bindgen::prelude::*;

/// Calculate score for a given dice combination and category
#[wasm_bindgen]
pub fn score_category(dice: &[u8], category: u8) -> Result<JsValue, JsValue> {
    let dice = parse_dice(dice).map_err(JsValue::from_str)?;

    let cat = Category::try_from(category).map_err(|e| JsValue::from_str(&e))?;

    let result = scoring::score(&dice, cat);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Calculate probabilities for all categories given current dice and kept mask
#[wasm_bindgen]
pub fn calculate_probabilities(
    dice: &[u8],
    kept: &[u8],
    rolls_remaining: u8,
) -> Result<JsValue, JsValue> {
    let dice = parse_dice(dice).map_err(JsValue::from_str)?;

    if kept.len() != 5 {
        return Err(JsValue::from_str("kept must be exactly 5 values"));
    }
    let kept_mask: [bool; 5] = [
        kept[0] != 0,
        kept[1] != 0,
        kept[2] != 0,
        kept[3] != 0,
        kept[4] != 0,
    ];

    let result = probability::calculate_all(&dice, &kept_mask, rolls_remaining);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Get all category scores for current dice (for scorecard display)
#[wasm_bindgen]
pub fn score_all_categories(dice: &[u8]) -> Result<JsValue, JsValue> {
    let dice = parse_dice(dice).map_err(JsValue::from_str)?;

    let results: Vec<ScoringResult> = Category::all()
        .iter()
        .map(|&cat| scoring::score(&dice, cat))
        .collect();

    serde_wasm_bindgen::to_value(&results).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Get metadata for all categories (names, sections)
#[wasm_bindgen]
pub fn get_categories() -> Result<JsValue, JsValue> {
    let categories: Vec<CategoryInfo> = Category::all().iter().map(|c| c.info()).collect();

    serde_wasm_bindgen::to_value(&categories).map_err(|e| JsValue::from_str(&e.to_string()))
}
