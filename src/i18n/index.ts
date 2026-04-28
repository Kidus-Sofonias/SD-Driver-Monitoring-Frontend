import { useApp } from "../state/AppContext";

export type LanguageMode = "en" | "am" | "om";

type TranslationKey =
  | "home"
  | "drivers"
  | "driver_record"
  | "workspace"
  | "app_tagline"
  | "active_trip"
  | "trip_results"
  | "trip_history"
  | "trip_details"
  | "review_dashboard"
  | "settings"
  | "loading_app"
  | "signed_in_as"
  | "driver_account"
  | "theme"
  | "light"
  | "dark"
  | "language"
  | "connection"
  | "account"
  | "english"
  | "amharic"
  | "oromo"
  | "sign_out"
  | "safe_driving"
  | "sign_in_start"
  | "auth_intro"
  | "login"
  | "register"
  | "email"
  | "password"
  | "driver_email_placeholder"
  | "password_placeholder"
  | "login_to_app"
  | "register_continue"
  | "backend_status"
  | "backend_hidden"
  | "current_backend"
  | "drive_overview"
  | "dashboard_intro"
  | "today_score"
  | "risk"
  | "confidence"
  | "events"
  | "trip_lifecycle"
  | "active_trip_monitor"
  | "trip_in_progress"
  | "ready_to_finalize"
  | "no_active_trip"
  | "elapsed_time"
  | "ended_at"
  | "samples_uploaded"
  | "samples_queued"
  | "sync_status"
  | "live"
  | "paused"
  | "idle"
  | "current_upload_health"
  | "last_sensor_batch"
  | "trip_ready_processing"
  | "start_trip_prompt"
  | "open_trip"
  | "end_trip"
  | "open_active_trip_page"
  | "start_trip"
  | "previous_finalized_trip"
  | "trip_result"
  | "open_results"
  | "no_finalized_trip"
  | "finalize_trip_help"
  | "top_reasons"
  | "recent_trips"
  | "no_finalized_trips_yet"
  | "finalized_trips_history_help"
  | "generated_events"
  | "latest_event_summary"
  | "generated_events_empty"
  | "latest_trip_result"
  | "awaiting_finalized_trip"
  | "results_page_live"
  | "results_page_fallback"
  | "results_page_empty"
  | "probability"
  | "processed"
  | "no_reasons_yet"
  | "events_empty_after_finalize"
  | "choose_trip_details"
  | "back_to_history"
  | "reasons"
  | "no_reasons_for_trip"
  | "no_events_for_trip"
  | "backend_settings"
  | "backend_hidden_settings"
  | "connected_health"
  | "refresh_data"
  | "session_theme"
  | "session_theme_help"
  | "finalized_trip_review"
  | "items_need_review"
  | "review_empty"
  | "admin_ops"
  | "driver_safety_command"
  | "admin_dashboard_intro"
  | "trips_tracked"
  | "need_review"
  | "average_score"
  | "average_confidence"
  | "trips_word"
  | "high_risk"
  | "best_driver"
  | "top_performer"
  | "open_latest_trip"
  | "top_performer_help"
  | "drivers_to_watch"
  | "attention_queue"
  | "open_review"
  | "pending_reviews_high_risk"
  | "no_watchlist_pressure"
  | "risk_mix"
  | "fleet_risk_breakdown"
  | "score_distribution"
  | "trips_by_score_band"
  | "recent_activity"
  | "trips_that_just_landed"
  | "waiting"
  | "driver_directory"
  | "manage_fleet_access"
  | "driver_directory_intro"
  | "all_drivers"
  | "active_accounts"
  | "search_drivers"
  | "search_driver_placeholder"
  | "drivers_matching"
  | "trips_recorded"
  | "last_trip"
  | "no_driver_accounts"
  | "no_drivers_match_search"
  | "edit_credentials"
  | "new_password"
  | "leave_blank_keep_password"
  | "cancel"
  | "save"
  | "delete"
  | "delete_driver"
  | "delete_driver_confirm"
  | "selected_trip"
  | "trip_review_detail"
  | "trip_id"
  | "predicted_label"
  | "rule_score"
  | "review_notes"
  | "review_notes_placeholder"
  | "mark_safe"
  | "mark_risky"
  | "clear_label"
  | "events_label"
  | "no_events"
  | "latest_finalized_trip"
  | "post_analysis_summary"
  | "trip_ended"
  | "started"
  | "finalize_trip"
  | "open_trip_results"
  | "no_active_trip_prompt"
  | "sync_sensor_batch"
  | "uploading_live_samples"
  | "samples_waiting_sync"
  | "last_synced_time";

const translations: Record<LanguageMode, Partial<Record<TranslationKey, string>>> = {
  en: {
    home: "Home",
    drivers: "Drivers",
    driver_record: "Driver record",
    workspace: "Workspace",
    app_tagline: "Live trip intelligence, AI scoring, and driver review in one place.",
    active_trip: "Active Trip",
    trip_results: "Trip Results",
    trip_history: "Trip History",
    trip_details: "Trip details",
    review_dashboard: "Review Dashboard",
    settings: "Settings",
    loading_app: "Loading app...",
    signed_in_as: "Signed in as",
    driver_account: "Driver account",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    language: "Language",
    connection: "Connection",
    account: "Account",
    english: "English",
    amharic: "Amharic",
    oromo: "Afaan Oromoo",
    sign_out: "Sign out",
    safe_driving: "DrivePulse",
    sign_in_start: "DrivePulse access and trip control",
    auth_intro: "Monitor live trips, review driving safety, and keep the field team aligned from one calm, premium workspace.",
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
    driver_email_placeholder: "driver@example.com",
    password_placeholder: "At least 8 characters",
    login_to_app: "Login to app",
    register_continue: "Register and continue",
    backend_status: "Backend status",
    backend_hidden: "Backend URL is configured from environment and hidden from the app UI.",
    current_backend: "Current backend",
    drive_overview: "Drive overview",
    dashboard_intro: "Live trip status, latest scoring, and generated events without the old preview clutter.",
    today_score: "Today score",
    risk: "Risk",
    confidence: "Confidence",
    events: "Events",
    trip_lifecycle: "Trip lifecycle",
    active_trip_monitor: "Active trip monitor",
    trip_in_progress: "Trip in progress",
    ready_to_finalize: "Ready to finalize",
    no_active_trip: "No active trip",
    elapsed_time: "Elapsed time",
    ended_at: "Ended at",
    samples_uploaded: "Samples uploaded",
    samples_queued: "Samples queued",
    sync_status: "Sync status",
    live: "Live",
    paused: "Paused",
    idle: "Idle",
    current_upload_health: "Current upload health",
    last_sensor_batch: "Last sensor batch uploaded {time}.",
    trip_ready_processing: "This trip has ended and is ready for final processing.",
    start_trip_prompt: "Start a trip to begin tracking.",
    open_trip: "Open trip",
    end_trip: "End trip",
    open_active_trip_page: "Open active trip page",
    start_trip: "Start trip",
    previous_finalized_trip: "Previous finalized trip",
    trip_result: "Trip result",
    open_results: "Open results",
    no_finalized_trip: "No finalized trip yet",
    finalize_trip_help: "Finalize a trip to see score, risk, confidence, reasons, and events here.",
    top_reasons: "Top reasons",
    recent_trips: "Recent trips",
    no_finalized_trips_yet: "No finalized trips yet",
    finalized_trips_history_help: "Finalized trips will show up here and open into a details page.",
    generated_events: "Generated events",
    latest_event_summary: "Latest event summary",
    generated_events_empty: "Generated events appear here after a trip is finalized.",
    latest_trip_result: "Latest trip result",
    awaiting_finalized_trip: "Awaiting finalized trip",
    results_page_live: "This page shows the last finalized trip returned by the backend after processing completes.",
    results_page_fallback: "This page is reading the most recent finalized trip already stored on the backend.",
    results_page_empty: "Finalize a trip and the backend will populate this page with score, risk, confidence, reasons, and generated events.",
    probability: "Probability",
    processed: "Processed",
    no_reasons_yet: "No finalized trip reasons yet.",
    events_empty_after_finalize: "Event cards will appear here after a trip is finalized.",
    choose_trip_details: "Choose a finalized trip from history to open its full detail view.",
    back_to_history: "Back to history",
    reasons: "Reasons",
    no_reasons_for_trip: "No reasons generated for this trip.",
    no_events_for_trip: "No generated events for this trip.",
    backend_settings: "Backend settings",
    backend_hidden_settings: "The backend URL is now read from environment so users cannot change it inside the app.",
    connected_health: "Connected health",
    refresh_data: "Refresh data",
    session_theme: "Session and theme",
    session_theme_help: "Use this page to switch theme and sign out of the current account.",
    finalized_trip_review: "Finalized trip review",
    items_need_review: "{count} items need review",
    review_empty: "Finalize a few trips first and they will appear here for review.",
    admin_ops: "Admin ops",
    driver_safety_command: "Driver safety command",
    admin_dashboard_intro: "Review fleet risk, spot the strongest drivers, and jump straight into the trips that need human attention.",
    trips_tracked: "Trips tracked",
    need_review: "Need review",
    average_score: "Average score",
    average_confidence: "Average confidence",
    trips_word: "trips",
    high_risk: "high risk",
    best_driver: "Best driver",
    top_performer: "Top performer",
    open_latest_trip: "Open latest trip",
    top_performer_help: "Top performer appears after a driver has at least 5 finalized trips.",
    drivers_to_watch: "Drivers to watch",
    attention_queue: "Attention queue",
    open_review: "Open review",
    pending_reviews_high_risk: "{pending} pending reviews, {highRisk} high-risk trips",
    no_watchlist_pressure: "No watchlist pressure yet.",
    risk_mix: "Risk mix",
    fleet_risk_breakdown: "Fleet risk breakdown",
    score_distribution: "Score distribution",
    trips_by_score_band: "Trips by score band",
    recent_activity: "Recent activity",
    trips_that_just_landed: "Trips that just landed",
    waiting: "{count} waiting",
    driver_directory: "Driver directory",
    manage_fleet_access: "Manage fleet access",
    driver_directory_intro: "Open any driver record to inspect their trips, rotate credentials, or remove access.",
    all_drivers: "All drivers",
    active_accounts: "{count} active accounts",
    search_drivers: "Search drivers",
    search_driver_placeholder: "Search by email",
    drivers_matching: "{count} drivers matching",
    trips_recorded: "{count} trips recorded",
    last_trip: "Last trip: {time}",
    no_driver_accounts: "No driver accounts have been created yet.",
    no_drivers_match_search: "No drivers match your search.",
    edit_credentials: "Edit credentials",
    new_password: "New password",
    leave_blank_keep_password: "Leave blank to keep current password",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    delete_driver: "Delete driver",
    delete_driver_confirm: "Delete {email} and all their trips? This cannot be undone.",
    selected_trip: "Selected trip",
    trip_review_detail: "Trip review detail",
    trip_id: "Trip ID",
    predicted_label: "Predicted label",
    rule_score: "Rule score",
    review_notes: "Review notes",
    review_notes_placeholder: "Add your review rationale",
    mark_safe: "Mark safe",
    mark_risky: "Mark risky",
    clear_label: "Clear label",
    events_label: "Events",
    no_events: "No events",
    latest_finalized_trip: "Latest finalized trip",
    post_analysis_summary: "Post-analysis summary",
    trip_ended: "Trip ended",
    started: "Started",
    finalize_trip: "Finalize trip",
    open_trip_results: "Open trip results",
    no_active_trip_prompt: "No active trip right now. Start a trip to begin tracking.",
    sync_sensor_batch: "Sync sensor batch",
    uploading_live_samples: "Collecting live samples",
    samples_waiting_sync: "{count} samples waiting to sync",
    last_synced_time: "Last synced {time}",
  },
  am: {
    home: "መነሻ",
    active_trip: "ንቁ ጉዞ",
    trip_results: "የጉዞ ውጤቶች",
    trip_history: "የጉዞ ታሪክ",
    trip_details: "የጉዞ ዝርዝር",
    review_dashboard: "የግምገማ ሰሌዳ",
    settings: "ቅንብሮች",
    loading_app: "መተግበሪያው በመጫን ላይ...",
    signed_in_as: "የገባው ተጠቃሚ",
    driver_account: "የአሽከርካሪ መለያ",
    theme: "ገጽታ",
    light: "ብርሃን",
    dark: "ጨለማ",
    language: "ቋንቋ",
    connection: "ግንኙነት",
    account: "መለያ",
    english: "እንግሊዝኛ",
    amharic: "አማርኛ",
    oromo: "አፋን ኦሮሞ",
    sign_out: "ውጣ",
    safe_driving: "DrivePulse",
    sign_in_start: "ግባ እና መንዳት ጀምር",
    auth_intro: "ገጽታህን ምረጥ፣ ከጀርባ አገልግሎቱ ጋር ተገናኝ፣ ከዚያም ግባ ወይም ተመዝገብ እና ጉዞዎችን ጀምር።",
    login: "ግባ",
    register: "ተመዝገብ",
    email: "ኢሜይል",
    password: "የይለፍ ቃል",
    driver_email_placeholder: "driver@example.com",
    password_placeholder: "ቢያንስ 8 ፊደላት",
    login_to_app: "ወደ መተግበሪያው ግባ",
    register_continue: "ተመዝገብ እና ቀጥል",
    backend_status: "የጀርባ ሁኔታ",
    backend_hidden: "የጀርባ አድራሻው በአካባቢ ቅንብር ተዘጋጅቶ ከመተግበሪያው ተሰውሯል።",
    current_backend: "አሁን ያለው ጀርባ",
    drive_overview: "የመንዳት እይታ",
    dashboard_intro: "የቀጥታ ጉዞ ሁኔታ፣ የቅርብ ጊዜ ውጤት እና የተፈጠሩ ክስተቶች በአንድ ቦታ።",
    today_score: "የዛሬ ነጥብ",
    risk: "አደጋ",
    confidence: "እምነት",
    events: "ክስተቶች",
    trip_lifecycle: "የጉዞ ሂደት",
    active_trip_monitor: "የንቁ ጉዞ ክትትል",
    trip_in_progress: "ጉዞ በሂደት ላይ ነው",
    ready_to_finalize: "ለመጨረስ ዝግጁ",
    no_active_trip: "ንቁ ጉዞ የለም",
    elapsed_time: "ያለፈ ጊዜ",
    ended_at: "ያበቃበት ጊዜ",
    samples_uploaded: "የተላኩ ሳምፕሎች",
    sync_status: "የማመሳሰል ሁኔታ",
    live: "ቀጥታ",
    paused: "ቆመ",
    idle: "አልተጀመረም",
    current_upload_health: "የማስገባት ሁኔታ",
    last_sensor_batch: "የመጨረሻው የሴንሰር ቡድን {time} ተልኳል።",
    trip_ready_processing: "ይህ ጉዞ ተጠናቋል እና ለመጨረሻ ሂደት ዝግጁ ነው።",
    start_trip_prompt: "መከታተል ለመጀመር ጉዞ ጀምር።",
    open_trip: "ጉዞ ክፈት",
    end_trip: "ጉዞ ጨርስ",
    open_active_trip_page: "የንቁ ጉዞ ገጽ ክፈት",
    start_trip: "ጉዞ ጀምር",
    previous_finalized_trip: "የቀድሞ የተጠናቀቀ ጉዞ",
    trip_result: "የጉዞ ውጤት",
    open_results: "ውጤቶችን ክፈት",
    no_finalized_trip: "ገና የተጠናቀቀ ጉዞ የለም",
    finalize_trip_help: "ነጥብ፣ አደጋ፣ እምነት፣ ምክንያቶች እና ክስተቶች እዚህ ለማየት ጉዞን ጨርስ።",
    top_reasons: "ዋና ምክንያቶች",
    recent_trips: "የቅርብ ጊዜ ጉዞዎች",
    no_finalized_trips_yet: "ገና የተጠናቀቁ ጉዞዎች የሉም",
    finalized_trips_history_help: "የተጠናቀቁ ጉዞዎች እዚህ ይታያሉ እና ወደ ዝርዝር ገጽ ይከፈታሉ።",
    generated_events: "የተፈጠሩ ክስተቶች",
    latest_event_summary: "የቅርብ ጊዜ የክስተት ማጠቃለያ",
    generated_events_empty: "ጉዞ ከተጠናቀቀ በኋላ ክስተቶች እዚህ ይታያሉ።",
    latest_trip_result: "የቅርብ ጊዜ የጉዞ ውጤት",
    awaiting_finalized_trip: "የተጠናቀቀ ጉዞ በመጠባበቅ ላይ",
    results_page_live: "ይህ ገጽ ከጀርባው የመጨረሻ የተጠናቀቀ ጉዞ ውጤትን ያሳያል።",
    results_page_fallback: "ይህ ገጽ በጀርባው ውስጥ የተቀመጠውን የቅርብ ጊዜ የተጠናቀቀ ጉዞ ያሳያል።",
    results_page_empty: "ጉዞ ከጨረስክ በኋላ ነጥብ፣ አደጋ፣ እምነት፣ ምክንያቶች እና ክስተቶች እዚህ ይመጣሉ።",
    probability: "እድል",
    processed: "የተሰራበት",
    no_reasons_yet: "ገና ምክንያቶች የሉም።",
    events_empty_after_finalize: "ጉዞ ከተጠናቀቀ በኋላ ክስተት ካርዶች እዚህ ይታያሉ።",
    choose_trip_details: "የተጠናቀቀ ጉዞ ከታሪኩ ላይ ምረጥ እና ዝርዝሩን ክፈት።",
    back_to_history: "ወደ ታሪክ ተመለስ",
    reasons: "ምክንያቶች",
    no_reasons_for_trip: "ለዚህ ጉዞ ምክንያቶች አልተፈጠሩም።",
    no_events_for_trip: "ለዚህ ጉዞ ክስተቶች የሉም።",
    backend_settings: "የጀርባ ቅንብሮች",
    backend_hidden_settings: "የጀርባ አድራሻው ከአካባቢ ቅንብር ይነበባል እና ተጠቃሚዎች በመተግበሪያው ውስጥ መቀየር አይችሉም።",
    connected_health: "የግንኙነት ሁኔታ",
    refresh_data: "ውሂብ አድስ",
    session_theme: "ክፍለ ጊዜ እና ገጽታ",
    session_theme_help: "በዚህ ገጽ ገጽታን ቀይር እና ከመለያህ ውጣ።",
    finalized_trip_review: "የተጠናቀቀ ጉዞ ግምገማ",
    items_need_review: "{count} ንጥሎች ግምገማ ይፈልጋሉ",
    review_empty: "በፊት ጥቂት ጉዞዎችን ጨርስ እና እዚህ ይታያሉ።",
    selected_trip: "የተመረጠ ጉዞ",
    trip_review_detail: "የጉዞ ግምገማ ዝርዝር",
    trip_id: "የጉዞ መለያ",
    predicted_label: "የተገመተ ምልክት",
    rule_score: "የደንብ ነጥብ",
    review_notes: "የግምገማ ማስታወሻ",
    review_notes_placeholder: "የግምገማህን ምክንያት ጨምር",
    mark_safe: "ደህንነተኛ አድርግ",
    mark_risky: "አደገኛ አድርግ",
    clear_label: "ምልክት አጥፋ",
    events_label: "ክስተቶች",
    no_events: "ክስተት የለም",
    latest_finalized_trip: "የቅርብ ጊዜ የተጠናቀቀ ጉዞ",
    post_analysis_summary: "ከሂደት በኋላ ማጠቃለያ",
    trip_ended: "ጉዞ ተጠናቋል",
    started: "የጀመረበት",
    finalize_trip: "ጉዞ ጨርስ",
    open_trip_results: "የጉዞ ውጤቶችን ክፈት",
    no_active_trip_prompt: "አሁን ንቁ ጉዞ የለም። መከታተል ለመጀመር ጉዞ ጀምር።",
    sync_sensor_batch: "የሴንሰር ቡድን አመሳስል",
  },
  om: {
    home: "Mana",
    drivers: "Ooftota",
    driver_record: "Galmee Ooftotaa",
    workspace: "Bakka hojii",
    app_tagline: "Safartuu imalaa yeroo dhugaa, qabxii AI, fi gamaaggama oftootaa bakka tokko keessatti.",
    active_trip: "Imala Itti Jiru",
    trip_results: "Bu'aa Imalaa",
    trip_history: "Seenaa Imalaa",
    settings: "Qindaa'ina",
    loading_app: "Appiin fe'amaa jirti...",
    signed_in_as: "Akka kanaan seente",
    theme: "Bifa",
    light: "Ifaa",
    dark: "Dukkana",
    language: "Afaan",
    connection: "Walqunnamtii",
    account: "Herrega",
    english: "English",
    amharic: "አማርኛ",
    oromo: "Afaan Oromoo",
    sign_out: "Ba'i",
    safe_driving: "DrivePulse",
    sign_in_start: "Seeniitii oofuu jalqabi",
    auth_intro: "Bifa filadhu, backend waliin walqabsiifadhu, sana booda seeni yookaan galmaa'i.",
    login: "Seeni",
    register: "Galmaa'i",
    email: "Imeelii",
    password: "Jecha icciitii",
    driver_email_placeholder: "driver@example.com",
    password_placeholder: "Qubee 8 yoo xiqqaate",
    login_to_app: "Appitti seeni",
    register_continue: "Galmaa'ii itti fufi",
    backend_status: "Haala backend",
    backend_hidden: "URL backend keessaa environment irraa qindaa'a; app keessatti hin mul'atu.",
    current_backend: "Backend ammaa",
    backend_settings: "Qindaa'ina backend",
    backend_hidden_settings: "URL backend environment irraa dubbifama; fayyadamtoonni app keessatti jijjiiruu hin danda'an.",
    connected_health: "Haala walqabsiisummaa",
    refresh_data: "Deetaa haaromsi",
    session_theme: "Kutaa fi bifa",
    session_theme_help: "Fuula kana irraa bifa jijjiiruu fi herrega keessaa bahuu dandeessa.",
    admin_ops: "Hojii adminii",
    driver_safety_command: "Bulchiinsa nageenya oftootaa",
    admin_dashboard_intro: "Balaa fleet ilaali, oftoota cimaa adda baasi, imaloota ilaalcha nama barbaadan saffisaan banuu dandeessi.",
    trips_tracked: "Imaloota hordofaman",
    need_review: "Gamaaggama barbaada",
    average_score: "Qabxii giddugaleessaa",
    average_confidence: "Amanamummaa giddugaleessaa",
    trips_word: "imaloota",
    high_risk: "balaa olaanaa",
    best_driver: "Ooftuu keessaa caalu",
    top_performer: "Kan hojii olaanaa agarsiise",
    open_latest_trip: "Imala isa dhumaa bani",
    top_performer_help: "Kan hojii olaanaa agarsiise kan mul'atu erga oftuun imala xumurame 5 qabaatee booda.",
    drivers_to_watch: "Ooftota hordofamuu qaban",
    attention_queue: "Tarree xiyyeeffannoo",
    open_review: "Gamaaggama bani",
    pending_reviews_high_risk: "Gamaaggamni {pending} eegaa jira, imaloonni balaa olaanaa {highRisk}",
    no_watchlist_pressure: "Ammaaf dhiibbaa tarree hordoffii hin jiru.",
    risk_mix: "Walmakaa balaa",
    fleet_risk_breakdown: "Caccabsa balaa fleet",
    score_distribution: "Raabsa qabxii",
    trips_by_score_band: "Imaloota kutaa qabxii irratti",
    recent_activity: "Sochii dhiyoo",
    trips_that_just_landed: "Imaloota amma dhufan",
    waiting: "{count} eegaa jira",
    driver_directory: "Galmee oftootaa",
    manage_fleet_access: "Seensa fleet to'adhu",
    driver_directory_intro: "Galmee oftuu kamiyyuu bani, imaloota isaa ilaali, seensawwan jijjiiri, yookaan hayyama haqii.",
    all_drivers: "Ooftota hunda",
    active_accounts: "Herregawwan hojii irra jiran {count}",
    search_drivers: "Ooftota barbaadi",
    search_driver_placeholder: "Imeeliidhaan barbaadi",
    drivers_matching: "Ooftota walsiman {count}",
    trips_recorded: "Imaloonni galmaa'an {count}",
    last_trip: "Imala dhumaa: {time}",
    no_driver_accounts: "Herregni oftootaa hanga ammaatti hin uumamne.",
    no_drivers_match_search: "Barbaacha kee waliin oftuun wal simatu hin jiru.",
    edit_credentials: "Ragaa seensaa gulaali",
    new_password: "Jecha icciitii haaraa",
    leave_blank_keep_password: "Kan amma jiru eeguuf duwwaa dhiisi",
    cancel: "Dhiisi",
    save: "Kuusi",
    delete: "Haqi",
    delete_driver: "Ooftuu haqii",
    delete_driver_confirm: "{email} fi imaloota isaa hunda haqxaa? Kun deebi'ee hin jijjiiramu.",
  },
};

const dynamicMap: Record<LanguageMode, Record<string, string>> = {
  en: {},
  am: {
    low: "ዝቅተኛ",
    medium: "መካከለኛ",
    high: "ከፍተኛ",
    completed: "ተጠናቋል",
    active: "ንቁ",
    unknown: "ያልታወቀ",
    harsh_braking: "ከባድ ብሬክ",
    sharp_turn: "ቀስተ መዞር",
    rapid_acceleration: "ፈጣን ፍጥነት መጨመር",
    "stable speed profile": "የፍጥነት እንቅስቃሴ የተረጋጋ ነበር",
    "small number of braking-related events": "ከብሬክ ጋር የተያያዙ ክስተቶች ብዛት ትንሽ ነበር",
    "high model confidence from consistent patterns": "ከተመሳሳይ ንድፎች የተነሳ የሞዴሉ እምነት ከፍተኛ ነበር",
    "no reasons generated.": "ምክንያቶች አልተፈጠሩም።",
  },
  om: {
    low: "Gadi-aanaa",
    medium: "Giddugaleessa",
    high: "Ol-aanaa",
    completed: "Xumurame",
    active: "Itti jira",
    unknown: "Hin beekamne",
    harsh_braking: "Bireekii cimaa",
    sharp_turn: "Garagalcha cimaa",
    rapid_acceleration: "Ariitii saffisaa",
    "stable speed profile": "Saffisni tasgabbaa'aa ture",
    "small number of braking-related events": "Taateewwan bireekii waliin walqabatan muraasa turan",
    "high model confidence from consistent patterns": "Akkaataa wal-fakkaataa irraa amanamummaan moodeelii olaanaa ture",
    "no reasons generated.": "Sababni hin uumamne.",
  },
};

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) {
    return template;
  }
  return Object.entries(vars).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

export function useI18n() {
  const { languageMode } = useApp();

  function t(key: TranslationKey, vars?: Record<string, string | number>) {
    return interpolate(translations[languageMode][key] || translations.en[key] || key, vars);
  }

  function translateDynamic(value?: string | null) {
    if (!value) {
      return "";
    }
    if (languageMode === "en") {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    const underscored = normalized.replace(/\s+/g, "_");
    return dynamicMap[languageMode][normalized] || dynamicMap[languageMode][underscored] || value;
  }

  return { languageMode, t, translateDynamic };
}
