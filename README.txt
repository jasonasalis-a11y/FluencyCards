FluencyCards v0.7.2

- Back/Next is hidden on course selection, lesson selection, Settings, and Offline Lessons screens.
- Added an Offline Lessons screen.
- Learners can select all available lessons or selected lessons and download the lesson JSON and audio.
- Opening Offline Lessons while online refreshes the catalog and reveals newly published lessons.
- Download progress and saved status are displayed.
- The service worker caches only the app shell automatically; lesson assets are explicitly downloaded.

Build:
cd ~/storage/downloads/FluencyCards_v0.7.2/builder
bash build.sh

Deploy:
Download/FluencyCards/deploy/FluencyCards_PWA_v0.7.2.zip
