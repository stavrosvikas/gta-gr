# GTA GR: ήχοι

Τα αρχεία μπαίνουν στο `game/assets/sounds/` με ακριβώς αυτό το όνομα (mp3, wav, ogg ή m4a). Όσο λείπει ένα αρχείο, η ατάκα φαίνεται μόνο σε φούσκα.

**Μετά από κάθε νέο αρχείο τρέξε `python update_sounds.py`** (ξαναφτιάχνει το `js/sounds_list.js`, αλλιώς το παιχνίδι δεν ξέρει ότι υπάρχει). Για έλεγχο: στην κονσόλα του browser `G.audio.status()`.

Παραλλαγές: `sfx_bark2`, `sfx_bark3`… παίζουν τυχαία μία κάθε φορά.

## Έχουν μπει (από το Premiere, A2)

| Αρχείο | Ατάκα |
|---|---|
| `vo_shepherd_marsars` | «Τι μαρσάρς; Τα κατσίκια τα γάμησες!» |
| `vo_shepherd_pista` | «Τι είναι εδώ; Πίστα είναι;» |
| `vo_shepherd_100` | «Περίμενε να πάρω το 100!» |
| `vo_priest_spasoume` | «Αυτά τα μηχανήματα πρέπει να τα σπάσουμε!» |
| `vo_priest` | «Αντίιιοοο… ΒΖΙΟΥΥΥΝ!» |
| `vo_pitch_ouou` | «Ου ου ου ου ου!» |
| `vo_pitch_skyli` | «Σκυλίιιι!» |
| `vo_pitch_tiririn` | «Τι ρι ριν τι τιν, τι ριν τι τιν!» |
| `vo_pitch_mesa` | «Και τώρα βλέπουμε… σκυλί μπαίνει μέσαααα!» |
| `vo_seraios_nekro` | «Μόνο ένα νεκρό φίδι είναι καλό φίδι.» |
| `vo_seraios_ssss` | «Χχσσσσσσ!» |
| `vo_seraios_katse` | «Sound, κάτσε καλά να πούμε!» |
| `vo_kados` | «Άντε γεια!» |
| `vo_student_1` | «Ιστορία γενικής δίναμε σήμερα.» |
| `vo_student_2` | «Τα θέματα ήταν εύκολα.» |
| `vo_student_3` | «Και εγώ δηλαδή δεν είχα παραδιαβάσει.» |
| `vo_student_4` | «Ε, θα μπορούσα και καλύτερα.» |
| `vo_student_5` | «Δε με πολυενδιαφέρει και βασικά κιόλας.» |
| `vo_rider_1` | «Ήσυχα ρεεε!» |
| `vo_rider_2` | «Εεειιι!» |
| `vo_rider_3` | «Ήσυχα ρε!» |
| `vo_rider_4` | «Ήσυχα!» |
| `vo_rider_5` | «ΗΣΥΧΑ!!» |
| `vo_gamath` | «Γαμάαθ;» |
| `vo_filos` | «Είναι φίλος μου!» |
| `vo_crete_panagia` | «Παναγία μου, θα σκοτωθούμε!» |
| `vo_crete_strofara` | «Πο πο μια στροφάρα! Έλα…!» |
| `vo_crete_ela` | «Οπ οπ οπ!» |
| `vo_beach_sun_a0` | «Gyros!» |
| `vo_beach_sun_a1` | «Gyros souvlaki!» |
| `vo_beach_sun_a2` | «Mustard sauce, ha!» |
| `radio_song` | Μην παραχαράσσετε την ιστορία (megamix), ραδιόφωνο στο αμάξι |
| `music_dance` | Όλα αυτά που φοβάμαι, ο χορός στο Σύνταγμα (~86 bpm, οι νότες είναι συγχρονισμένες) |

## Οχήματα, πόλη, σκυλιά (Epidemic Sound μέσω Higgsfield)

| Αρχείο | Τι είναι |
|---|---|
| `loop_eng_car` | μηχανή αμαξιού (loop, ακούγεται από κάθε αμάξι κοντά σου, ανεβαίνει με την ταχύτητα) |
| `loop_eng_big` | λεωφορείο, φορτηγό, βαν, σκουπιδιάρικο |
| `loop_eng_moto` | μηχανάκι / παπάκι (και η μηχανή του τσοπάνη) |
| `loop_siren` | σειρήνα περιπολικού / ΔΙΑΣ όσο κυνηγάει |
| `loop_city` | πολύ χαμηλό «χαλί» πόλης στην Αθήνα |
| `sfx_siren`, `sfx_horn`, `sfx_horn2`, `sfx_crash`, `sfx_skid`, `sfx_door`, `sfx_heli`, `sfx_boat_horn`, `sfx_train_horn` | εφέ |
| `sfx_bark` … `sfx_bark4` | σκυλιά (αδέσποτα που γαβγίζουν κάπου γύρω σου + τα σκυλιά των αποστολών) |

## Λείπουν ακόμα

### Ατάκες (προαιρετικές: χωρίς αρχείο φαίνονται μόνο σε φούσκα)

| Αρχείο | Ατάκα στη φούσκα |
|---|---|
| `vo_beach_bike_splash` | «Πάλι βράχηκα!» |
| `vo_beach_gtr_again` | «Πάμε απ' την αρχή!» |
| `vo_beach_gtr_hum` | «♪ ♪ ♪» |
| `vo_beach_gtr_more` | «Άλλη μία!» |
| `vo_beach_racket_nice` | «Ωραία μπαλιά!» |
| `vo_beach_racket_sorry` | «Συγγνώμη!» |
| `vo_cop_agapi` | «Αγάπη μόνο!» |
| `vo_cop_lera` | «Λέρα! Μεγάλη λέρα!» |
| `vo_fd_host_kickout` | «Αυτό ήταν. Έξω! Ούτε για δεύτερο ραντεβού δεν κάνεις.» |
| `vo_fd_host_warn` | «Ε! Άσε τα ζευγάρια ήσυχα. Τελευταία προειδοποίηση!» |
| `vo_fd_host_welcome` | «Καλώς ήρθες στο First Dates! Κάτσε όπου βρεις.» |
| `vo_fd_waiter_serve` | «Καλή όρεξη! Και καλή τύχη... με όλα.» |
| `vo_ferrari_fall` | «Μην τα ρίχνεις! Κάθε πρόβατο είναι σαράντα ευρώ!» |
| `vo_ferrari_go` | «Σε περιμένω στο άλλο χωράφι! Πρόσεχε τις λακκούβες, είναι ΕΣΠΑ.» |
| `vo_ferrari_herd` | «Βάλ' τα στο φορτηγό, χρυσό μου! Εγώ λάσπη δεν πατάω, είναι Gucci.» |
| `vo_ferrari_hi` | «Γεια σου κούκλε! Θέλω βοήθεια με κάτι… αγροτικές δουλειές.» |
| `vo_ferrari_insp_dog` | «…κι αυτό με τον φιόγκο. Γαβγίζει, αλλά πρόβατο. Το γράφω.» |
| `vo_ferrari_insp_start` | «Έλεγχος ΟΠΕΚΕΠΕ! Για να μετρήσουμε…» |
| `vo_ferrari_own` | «Το χωράφι το δήλωσα… απλώς δεν είναι δικό μου.» |
| `vo_ferrari_why` | «Τα πρόβατα θα μετρηθούν στο άλλο χωράφι. Εκεί τα έχω δηλώσει.» |
| `vo_ferrari_win` | «Τέλεια! Του χρόνου δηλώνουμε και τη Ferrari για τρακτέρ.» |
| `vo_milos_boss` | «Πρώτη μέρα; Σαμπάνιες στους τουρίστες, γρήγορα!» |
| `vo_milos_ouch` | «Άουτς! Λαγοκέφαλος!» |
| `vo_protopsalti_combo` | «Αυτό είναι! Δώσ' του!» |
| `vo_protopsalti_lose` | «Δεν πειράζει, αγάπη μου. Ο δρόμος είναι μακρύς. Ξαναπάμε απ' την αρχή!» |
| `vo_protopsalti_miss` | «Στον ρυθμό, παιδί μου!» |
| `vo_protopsalti_start` | «Καλησπέρα Σύνταγμα! Από τον δρόμο, με αγάπη! Πάμε να χορέψουμε!» |
| `vo_protopsalti_win` | «Μπράβο ρε! Τέτοιο χορό ούτε σε πανηγύρι τον Δεκαπενταύγουστο. Έλα αύριο, σε παίρνουμε στο φορτηγό!» |
| `vo_revive_m` | «Μην ανησυχείς. Το μηχάνημα είναι πιστοποιημένο… κάπου.» |
| `vo_seraios_bite` | «Σε τσίμπησε; Φτου φτου, δεν είναι τίποτα!» |
| `vo_seraios_cat` | «Άσε τη γάτα, αυτή βοηθάει!» |
| `vo_seraios_flush` | «Βγήκε! Βγήκε!» |
| `vo_seraios_hit` | «Μπράβο! Άλλη μία!» |
| `vo_seraios_start` | «Εκεί είναι! Στα χόρτα! Φέρε τη σκούπα!» |
| `vo_seraios_win` | «Τέλος! Πάμε για τσίπουρα!» |
| `vo_shepherd_dora` | «Πάρε το ποδήλατο του παππού. Αλλάξαμε!» |
| `vo_shepherd_kala` | «Καλά! Θα τα ξαναπούμε εμείς!» |
| `vo_shepherd_mixanimou` | «Ρε, τη μηχανή μου!» |
| `vo_shepherd_opa` | «ΟΠΑ! Πού πας εσύ;» |

Επίσης: `vo_cyclist_1` … `vo_cyclist_6` (οι φωνές σου πίσω από τον ποδηλάτη), `vo_reporter_q0` … `q6` (οι ερωτήσεις της δημοσιογράφου στο σχολείο), `vo_beach_rep_q0` … `q3` (ο ρεπόρτερ στην παραλία), `vo_beach_buried_0` … `2`, `vo_tourist_panic`, `vo_ped_hit`, `vo_driver_angry`, `vo_carjack`.

### Εφέ

`sfx_baa`, `sfx_bad`, `sfx_blip`, `sfx_cheer`, `sfx_coin`, `sfx_good`, `sfx_hiss`, `sfx_hit`, `sfx_meow`, `sfx_mission_fail`, `sfx_mission_pass`, `sfx_punch`, `sfx_revive`, `sfx_splash`, `sfx_star`, `sfx_tax`, `sfx_whoosh`, `sfx_tok`, `sfx_ball_bounce`, `sfx_ball_swish`, `sfx_ball_rim`

### Μουσική αποστολών

`music_crete`, `music_cyclist`, `music_ferrari`, `music_milos`, `music_pitch`, `music_seraios`, `music_shepherd`, `music_shepherd_chase`
