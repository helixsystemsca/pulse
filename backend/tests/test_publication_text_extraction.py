from app.services.publication.text_extraction import (
    detect_input_format,
    extract_plain_text_from_raw,
    normalize_input_text,
    preprocess_input,
)

TAGGED = """<pstyle:Eventage>3 - 5 yrs
<pstyle:Eventname>Tiny Timbers
<pstyle:Eventdescription>Camp fun.
<pstyle:Eventdetail>M-F 9am Jul 6 $10 12345"""

RTF_WRAPPED = (
    "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\par "
    + TAGGED.replace("\n", "\\par ")
    + " \\par}"
)


def test_detect_input_format_by_extension():
    assert detect_input_format("a.txt") == "txt"
    assert detect_input_format("b.rtf") == "rtf"


def test_preprocess_txt():
    out = preprocess_input(TAGGED, filename="x.txt")
    assert out["sourceFormat"] == "txt"
    assert out["isXplorTagged"] is True
    assert "<pstyle:Eventname>" in out["plainText"]


def test_preprocess_rtf_uses_striprtf():
    out = preprocess_input(RTF_WRAPPED, filename="x.rtf")
    assert out["sourceFormat"] == "rtf"
    assert out["isXplorTagged"] is True
    assert "Tiny Timbers" in out["plainText"]


def test_normalize_collapses_blank_lines():
    assert normalize_input_text("a\n\n\nb") == "a\n\nb"


def test_txt_not_stripped():
    assert extract_plain_text_from_raw(TAGGED, "txt") == normalize_input_text(TAGGED)
