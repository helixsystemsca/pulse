from app.services.training_platform.card_type_normalizer import (
    coerce_import_flashcard_dict,
    normalize_study_type,
)


def test_normalize_study_type_legacy_aliases() -> None:
    assert normalize_study_type("multiple_choice") == "mcq"
    assert normalize_study_type("true_false") == "tf"
    assert normalize_study_type("flashcard") == "flashcard"
    assert normalize_study_type("definition") == "flashcard"


def test_coerce_import_flashcard_dict_merges_options() -> None:
    raw = {
        "type": "mcq",
        "question": "Pick one",
        "answer": "B",
        "choices": ["A", "B", "C"],
        "correctAnswer": 1,
    }
    out = coerce_import_flashcard_dict(raw)
    assert out["card_type"] == "mcq"
    assert out["prompt"] == "Pick one"
    assert out["options"]["choices"] == ["A", "B", "C"]
    assert out["options"]["correct_index"] == 1
