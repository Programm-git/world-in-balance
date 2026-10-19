# World In Balance

Erstelle einen packenden, echtzeitbasierten Militär- und Geopolitik-Simulator im Stil eines immersiven "War Room / Situationszentrums" (Kommandozentrale eines Staatsoberhaupts).

### 1. Visuelles Konzept & Layout (War Room):
* **Zentrum (3D-Hologramm-Globus):**
  * Interaktiver, frei rotier- und zoombarer 3D-Globus (Three.js / dunkler, eleganter Vektor- und Taktik-Look im DEFCON-Stil).
  * Fokus auf maximale Übersichtlichkeit: Landesgrenzen, Großstädte, Frontlinien, fliegende Fliegerstaffeln und leuchtende ballistische Flugbahnen von Raketen.
  * Umschaltbare Filter-Ebenen: "Militär" (Fronten, Silos, Staffeln), "Zivilschutz" (Städte, Bunker) und "Wirtschaft" (Uran-Minen, Fabriken), damit die Karte nie überladen wirkt.
* **Schreibtisch des Befehlshabers (Unten):**
  * Befehlsakten & Terminals zum Wechseln zwischen Wirtschaft, Zivilschutz, Militär und Forschung.
  * Notfall-Auslöser: Zivilschutz-Sirenen aktivieren (Evakuierung in Bunker) und Raketen-Abschussfreigabe.
  * Zeitsteuerung: Play/Pause, 1x, 2x, 5x Geschwindigkeit und Datumsanzeige.
* **Kopfleiste (Nationale Vitalwerte):**
  * Bevölkerung (Gesamt / Sicher im Bunker / Gefallene).
  * Volksmoral (Farb- & Prozentbalken mit klarer Rebellions-Warnung bei < 25%).
  * Ressourcen: Militärisches Uran (kg), Industriekapazität/Stahl, Energie/Treibstoff.
  * DEFCON-Statusanzeige (DEFCON 5 bis DEFCON 1).
* **Seiten-Monitore:**
  * Links: Zivilschutz-Status der Städte, Bunkerausbaustufen und Unruhe-/Streik-Indikatoren.
  * Rechts: Militärbereitschaft, Fliegerstaffeln, Silo-Status und Radar-Frühwarnsystem mit Einschlags-ETA.

### 2. Wirtschaft & Produktion:
* **Rohstoffe & Minen:** Abbau von Uran für Nuklearsprengköpfe und fortgeschrittene Waffen sowie Grundmetalle.
* **Fabriken & Rüstungswerke:** Bauen Fliegerstaffeln, Abfangraketen, Bunker-Verstärkungen und Munition.
* Minen und Fabriken können Ziel feindlicher Bombardements werden.

### 3. Zivilschutz, Moral & Rebellion:
* **Bunkerbau & Schutzräume:** Städte können Schutzräume und Tiefbunker bauen. Kapazitäten sind begrenzt.
* **Volksmoral:** Sinkt drastisch bei zivilen Verlusten und Bombardements. Fällt die Moral zu tief, drohen Streiks, Unruhen und schließlich ein gewaltsamer Putsch/Rebellion (Game Over von innen).
* Rechtzeitiges Evakuieren in Bunker und erfolgreiche Luftabwehr schützen die Moral.

### 4. Streitkräfte & Fronten:
* **Fliegerstaffeln:** Jäger (Luftraumüberwachung & Abfangen feindlicher Bomber) und Bomber (gezielte Angriffe auf feindliche Minen, Silos und Städte).
* **Raketensilos & Abwehr:** Bau von Silos für ballistische Schläge sowie Flugabwehrschirmen (Iron-Dome-Systeme) zum Abfangen anfliegender Geschosse.
* **Fronten:** Dynamische Grenzkonflikte mit Bodentruppen.

### 5. Lebendige Welt (Autonome NPC-Länder) & Eskalation:
* Mehrere spielbare und KI-gesteuerte Nationen auf der Weltkarte.
* Autonome KI: NPCs führen auch untereinander Kriege, schließen Bündnisse oder greifen den Spieler an.
* Steigender Schwierigkeitsgrad im Laufe der Zeit: Die Welt rüstet kontinuierlich auf, Ressourcen werden knapper, Kriegsmüdigkeit steigt und die globale Eskalationsstufe treibt das Spiel unweigerlich in einen Weltkrieg.

### 6. Sieg- & Niederlage-Bedingungen:
* **Sieg:** Alle feindlichen Nationen sind entweder militärisch besiegt ODER ihre Moral ist komplett kollabiert (Rebellion/Sturz der feindlichen Führung).
* **Niederlage:** Eigene Hauptstadt/Infrastruktur vernichtet ODER eigene Bevölkerung stürzt die Regierung wegen zu hoher Verluste.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b7a23215-c3ea-4ba1-b6b1-8fb2cc7a7a92).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
