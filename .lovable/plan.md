

## Fixed vs Sticky na mobile — analiza

**`fixed` nie zadziała** dla nagłówków stacji, bo one muszą **scrollować się horyzontalnie** razem z siatką, ale **pozostawać na miejscu wertykalnie**.

- `position: fixed` — element jest wyjęty z flow i przytwierdzony do viewportu. Nagłówki stacji nie będą się przesuwać przy horyzontalnym scrollu → złamany layout.
- `position: sticky` — element scrolluje się z rodzicem, ale "przykleja" gdy osiągnie próg. Scrolluje horyzontalnie z kontenerem, ale stoi wertykalnie → dokładnie to czego potrzebujemy.

### Gdzie sticky jest OK, gdzie fixed jest OK

| Element | Scroll H? | Scroll V? | Pozycjonowanie |
|---------|-----------|-----------|----------------|
| Header (nawigacja, data) | nie | nie | `sticky top-0` **lub** `fixed` — oba OK, bo nie scrolluje się horyzontalnie |
| Nagłówki stacji | **tak** | nie | **musi być `sticky`** — fixed złamałby horizontal scroll |
| Kolumna czasu | nie | **tak** | `sticky left-0` — musi scrollować wertykalnie |

### Wniosek

Problem nie leży w `sticky` vs `fixed`. Problem leży w **zagnieżdżonych kontenerach scrolla** — `sticky` działa poprawnie, ale tylko relatywnie do swojego najbliższego scrollowalnego rodzica. Gdy mamy dwa nakładające się (`content-wrapper` + `gridScrollRef`), sticky nie wie do którego się "przykleić".

Rozwiązanie to nadal **jeden kontener scrollowalny + sticky**, jak w poprzednim planie. Ewentualnie sam header nawigacyjny (data, strzałki) może być `fixed` bo nie scrolluje się horyzontalnie — ale nagłówki stacji i kolumna czasu muszą pozostać `sticky`.

Czy zatwierdzasz plan z poprzedniej wiadomości (jeden kontener + sticky)?

