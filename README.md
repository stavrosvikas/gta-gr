# GTA GR

Σατιρικό fan game (top-down, HTML5 canvas, vanilla JS) για PC και κινητό. Όλα τα γραφικά ζωγραφίζονται σε κώδικα.

## Παίξε τοπικά
Άνοιξε έναν απλό server μέσα στον φάκελο και πήγαινε στο `http://localhost:8765`:

```
python -m http.server 8765
```

## Δομή
- `index.html`: φορτώνει όλα τα scripts
- `js/`: πυρήνας, κόσμος, οντότητες, UI, κινητό, μενού
- `js/quests/`: μία αποστολή ανά αρχείο (βλ. `REGIONS.md`)
- `assets/sounds/`: ήχοι (λίστα στο `SOUNDS.md`)
- `assets/logo/`: logo
