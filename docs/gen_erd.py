import graphviz

def table_node(g, name, cols, color="#2e7d4f"):
    rows = "".join(
        f'<TR><TD ALIGN="LEFT" PORT="{c[0]}"><FONT COLOR="{"#b8860b" if "PK" in c[2] else "#1565c0" if "FK" in c[2] else "black"}">'
        f'{"🔑 " if "PK" in c[2] else ("↳ " if "FK" in c[2] else "")}{c[0]}</FONT>'
        f'  <FONT COLOR="gray50">{c[1]}</FONT></TD></TR>'
        for c in cols
    )
    label = (
        f'<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">'
        f'<TR><TD BGCOLOR="{color}" ALIGN="CENTER"><FONT COLOR="white"><B>{name}</B></FONT></TD></TR>'
        f'{rows}</TABLE>>'
    )
    g.node(name, label=label, shape="plaintext")

# ---------------- fluencycards ----------------
g = graphviz.Digraph("fluencycards", format="png")
g.attr(rankdir="LR", fontname="Helvetica", bgcolor="white", splines="ortho")
g.attr("node", fontname="Helvetica", fontsize="11")
g.attr("edge", fontname="Helvetica", fontsize="9", color="gray40")

CONTENT = "#2e7d4f"
TUTOR = "#8a4b9b"
SYNC = "#c0392b"

tables = {
    "courses": ([("course_id","TEXT","PK"),("title_en","TEXT",""),("current_version_id","TEXT",""),("price_cents","INTEGER","0 = free"),("published","INTEGER","")], CONTENT),
    "course_versions": ([("version_id","TEXT","PK"),("course_id","TEXT","FK"),("status","TEXT",""),("r2_object_key","TEXT",""),("content_sha256","TEXT","")], CONTENT),
    "images": ([("image_id","TEXT","PK"),("concept_id","TEXT","= phrase_number"),("r2_key","TEXT",""),("width","INTEGER","256"),("height","INTEGER","256")], CONTENT),
    "course_card_images": ([("course_id","TEXT","PK/FK"),("course_version","TEXT","PK"),("activity_id","TEXT","PK"),("image_id","TEXT","FK")], CONTENT),
    "image_generation_jobs": ([("job_id","TEXT","PK"),("course_id","TEXT",""),("status","TEXT","")], CONTENT),
    "image_generation_items": ([("job_id","TEXT","PK/FK"),("activity_id","TEXT","PK"),("concept_id","TEXT",""),("image_id","TEXT","FK")], CONTENT),
    "course_keys": ([("course_key","TEXT","PK"),("course_id","TEXT","FK"),("amount_paid_cents","INTEGER","0 for free"),("max_devices","INTEGER","NULL=unlimited"),("status","TEXT","")], TUTOR),
    "course_key_devices": ([("course_key","TEXT","PK/FK"),("device_id","TEXT","PK"),("removed_at","TEXT","null=active slot")], TUTOR),
    "certificate_orders": ([("order_id","TEXT","PK"),("course_key","TEXT","FK"),("recipient_name","TEXT","checkout-only"),("email","TEXT","checkout-only"),("amount_cents","INTEGER","")], TUTOR),
    "users": ([("user_id","TEXT","PK"),("email","TEXT",""),("role_flags","INTEGER","tutor/creator/admin only"),("status","TEXT","")], TUTOR),
    "tutor_profiles": ([("tutor_id","TEXT","PK/FK"),("id_document_r2_key","TEXT","private"),("application_status","TEXT",""),("session_credit_balance","INTEGER",""),("is_course_creator","INTEGER","")], TUTOR),
    "tutor_languages": ([("tutor_id","TEXT","PK/FK"),("language_code","TEXT","PK, cross-DB"),("credential_type","TEXT","")], TUTOR),
    "tutor_reviews": ([("review_id","TEXT","PK"),("tutor_id","TEXT","FK"),("course_key","TEXT","FK, = student"),("connection_id","TEXT","FK"),("rating","INTEGER","1-5")], TUTOR),
    "tutor_credit_purchases": ([("purchase_id","TEXT","PK"),("tutor_id","TEXT","FK"),("sessions_purchased","INTEGER","100"),("amount_cents","INTEGER","1000")], TUTOR),
    "tutor_signup_payments": ([("payment_id","TEXT","PK"),("tutor_id","TEXT","FK"),("amount_cents","INTEGER","2000")], TUTOR),
    "connections": ([("connection_id","TEXT","PK"),("course_key","TEXT","FK, = student"),("tutor_id","TEXT","FK"),("course_id","TEXT","FK"),("status","TEXT","")], TUTOR),
    "tutor_session_usage": ([("usage_id","TEXT","PK"),("tutor_id","TEXT","FK"),("connection_id","TEXT","FK"),("session_cost_cents","INTEGER","10")], TUTOR),
    "student_progress_sync": ([("connection_id","TEXT","PK/FK"),("lesson_id","TEXT",""),("current_activity_id","TEXT",""),("updated_at","TEXT","")], SYNC),
    "student_review_queue_sync": ([("connection_id","TEXT","PK/FK"),("item_id","TEXT","PK"),("reason","TEXT","wrong_answer/low_rating")], SYNC),
}
for name, (cols, color) in tables.items():
    table_node(g, name, cols, color)

edges = [
    ("courses","course_versions"),("course_versions","course_card_images"),
    ("images","course_card_images"),("courses","image_generation_jobs"),
    ("image_generation_jobs","image_generation_items"),("images","image_generation_items"),
    ("courses","course_keys"),("course_keys","course_key_devices"),
    ("course_keys","certificate_orders"),
    ("users","tutor_profiles"),("tutor_profiles","tutor_languages"),
    ("tutor_profiles","tutor_reviews"),("course_keys","tutor_reviews"),
    ("tutor_profiles","tutor_credit_purchases"),("tutor_profiles","tutor_signup_payments"),
    ("course_keys","connections"),("tutor_profiles","connections"),("courses","connections"),
    ("connections","tutor_session_usage"),("connections","student_progress_sync"),
    ("connections","student_review_queue_sync"),("connections","tutor_reviews"),
]
for a,b in edges:
    g.edge(a,b)

g.render("/home/claude/schema-design/fluencycards-erd", cleanup=True)

# ---------------- fluencyengine-languages ----------------
g2 = graphviz.Digraph("fluencyengine_languages", format="png")
g2.attr(rankdir="LR", fontname="Helvetica", bgcolor="white", splines="ortho")
g2.attr("node", fontname="Helvetica", fontsize="11")
g2.attr("edge", fontname="Helvetica", fontsize="9", color="gray40")

LANG = "#1f6f8b"
JOB = "#b26a00"

tables2 = {
    "languages": ([("language_code","TEXT","PK"),("english_name","TEXT",""),("status","TEXT","planned/.../published")], LANG),
    "phrase_bank": ([("phrase_number","INTEGER","PK 1..36000"),("english_text","TEXT",""),("module_number","INTEGER","1..400"),("lesson_number","INTEGER","1..5"),("position_in_lesson","INTEGER","1..18"),("complexity_tier","INTEGER",""),("is_survival_phrase","INTEGER","")], LANG),
    "translations": ([("translation_id","TEXT","PK"),("phrase_number","INTEGER","FK"),("language_code","TEXT","FK"),("translated_text","TEXT",""),("confidence_score","REAL","threshold .94"),("status","TEXT","")], LANG),
    "phonics_inventory": ([("phoneme_id","TEXT","PK"),("language_code","TEXT","FK"),("grapheme","TEXT",""),("category","TEXT","cons/vowel/blend/digraph"),("frequency_rank","INTEGER",""),("mastery_target_module","INTEGER","")], LANG),
    "phonics_card_assignments": ([("assignment_id","TEXT","PK"),("language_code","TEXT","FK"),("phoneme_id","TEXT","FK"),("module_number","INTEGER",""),("lesson_number","INTEGER",""),("card_variant","TEXT","introduce/recall")], LANG),
    "audio_assets": ([("asset_id","TEXT","PK"),("phrase_number","INTEGER","FK, null if phoneme"),("phoneme_id","TEXT","FK, null if phrase"),("language_code","TEXT","FK"),("source_type","TEXT","edge_tts/human/..."),("object_key","TEXT",""),("approved","INTEGER","")], LANG),
    "translation_jobs": ([("job_id","TEXT","PK"),("language_code","TEXT","FK"),("range_start","INTEGER",""),("range_end","INTEGER",""),("status","TEXT","")], JOB),
    "audio_generation_jobs": ([("job_id","TEXT","PK"),("language_code","TEXT","FK"),("provider","TEXT",""),("status","TEXT","")], JOB),
    "audio_generation_items": ([("job_id","TEXT","PK/FK"),("phrase_number","INTEGER","FK"),("phoneme_id","TEXT","FK"),("status","TEXT","")], JOB),
    "course_build_jobs": ([("job_id","TEXT","PK"),("course_id","TEXT","cross-DB, no FK"),("language_code","TEXT","FK"),("output_r2_key","TEXT",""),("status","TEXT","")], JOB),
}
for name, (cols, color) in tables2.items():
    table_node(g2, name, cols, color)

edges2 = [
    ("languages","translations"),("languages","phonics_inventory"),
    ("languages","phonics_card_assignments"),("languages","audio_assets"),
    ("languages","translation_jobs"),("languages","audio_generation_jobs"),
    ("languages","course_build_jobs"),
    ("phrase_bank","translations"),("phrase_bank","audio_assets"),
    ("phrase_bank","audio_generation_items"),
    ("phonics_inventory","phonics_card_assignments"),("phonics_inventory","audio_assets"),
    ("phonics_inventory","audio_generation_items"),
    ("translation_jobs","translations"),("audio_generation_jobs","audio_generation_items"),
]
for a,b in edges2:
    g2.edge(a,b)

g2.render("/home/claude/schema-design/fluencyengine-languages-erd", cleanup=True)
print("done")
