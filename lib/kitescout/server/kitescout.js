// kitescout.js

const axios = require('axios');
const dbhelper = require("./dbHelper.js"); // Antaget namn

// URL till ditt Python Prediktions-API (konfigurerbar)
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000"; // Anpassa!

// Skapa ett objekt som ska exporteras
const kitescout = {};

// *** Funktion för att hämta och förbereda data (DENNA ÄR KOMPLEX) ***
// Denna ligger nu utanför export-objektet, men kan anropas internt
async function getPreparedLookbackData(targetTimestamp) { // Tar emot targetTimestamp
    const lookbackMinutes = 90; // Hämta minst 90 min historik FÖRE target time
    const toDate = targetTimestamp || new Date(); // Använd target time eller nu som slutpunkt
    const fromDate = new Date(toDate.getTime() - lookbackMinutes * 60 * 1000);
    const fromDateIso = fromDate.toISOString();
    const toDateIso = toDate.toISOString();

    // **** DEBUG LOG 2 ****
    console.log(`[Node Backend] Fetching DB data from ${fromDateIso} to ${toDateIso}`);

    // Hämta rådata parallellt (upp till toDate)
    const dataPromises = [
        dbhelper.getData("entries", "type", "sgv", 500, fromDateIso, toDateIso),
        dbhelper.getData("treatments", null, null, 500, fromDateIso, toDateIso),
        dbhelper.getData("devicestatus", "openaps", null, 500, fromDateIso, toDateIso),
        dbhelper.getProfile(fromDateIso)
    ];
    const [sgvData, treatmentsData, devicestatusData, profileData] = await Promise.all(dataPromises);

     // Identifiera den faktiska sista tidpunkten i den hämtade datan
     // eller använd targetTimestamp om det specificerats
     let lastActualTimestamp = targetTimestamp || fromDate; // Startgissning
     const findLatest = (data, timeField) => {
         if (data && data.length > 0) {
              // Sortera nyast först för säkerhets skull om dbhelper inte garanterar det
              data.sort((a, b) => new Date(b[timeField]) - new Date(a[timeField]));
              const latestEntryTime = new Date(data[0][timeField]);
              if (!targetTimestamp && latestEntryTime > lastActualTimestamp) {
                   lastActualTimestamp = latestEntryTime;
              } else if (targetTimestamp && latestEntryTime <= targetTimestamp && latestEntryTime > lastActualTimestamp ) {
                   lastActualTimestamp = latestEntryTime;
              }
         }
    };
     // Välj rätt tidsfält för SGV
     const sgvTimeField = sgvData?.[0]?.date ? 'date' : 'created_at';
     findLatest(sgvData, sgvTimeField);
     findLatest(treatmentsData, 'created_at');
     findLatest(devicestatusData, 'created_at');

     const finalLastTimestamp = targetTimestamp || lastActualTimestamp;
     // **** DEBUG LOG 3 ****
     console.log(`[Node Backend] Timestamp being sent to Python API (finalLastTimestamp): ${finalLastTimestamp.toISOString()}`);


     // Skapa payload
     const payload = {
         sgv_data: sgvData,
         treatments_data: treatmentsData,
         devicestatus_data: devicestatusData,
         profile_data: profileData[0] || null,
         last_timestamp_iso: finalLastTimestamp.toISOString()
     };

     return payload; // Returnera payloaden
}


// Definiera funktionen som ska hantera requesten och exporteras
// Lägg TILL denna funktion till kitescout-objektet
kitescout.getAiPrediction = async function (req, res) {
    console.log('API: getAiPrediction called');
    const start = Date.now();
    try {
        // 1. Hämta target timestamp från query parametrar
        const targetTimestampIso = req.query.target_timestamp;
        let targetTimestamp = null;
        if (targetTimestampIso) {
            targetTimestamp = new Date(targetTimestampIso);
            if (isNaN(targetTimestamp.getTime())) {
                return res.status(400).send({ error: 'Invalid target_timestamp format.' });
            }
             // **** DEBUG LOG 1 ****
             console.log(`[Node Backend] Target timestamp PARSED as: ${targetTimestamp.toISOString()}`);
        } else {
             console.log("[Node Backend] No target timestamp received, using latest.");
        }

        // 2. Hämta och förbered data (anropar hjälpfunktionen)
        const payload = await getPreparedLookbackData(targetTimestamp);

        if (!payload) {
             return res.status(500).send({ error: 'Failed to prepare input data for prediction.' });
        }

        // ***** DEBUG LOG 4: Logga payloaden som ska skickas *****
        console.log("[Node Backend] Payload BEING SENT to Python:");
        console.log(JSON.stringify(payload, null, 2));

        // 3. Anropa Python API via POST
        console.log(`[Node Backend] Calling Python API at ${PYTHON_API_URL}/predict_from_raw/`);
        const predictionResponse = await axios.post(`${PYTHON_API_URL}/predict_from_raw/`, payload, {
             headers: { 'Content-Type': 'application/json' },
             timeout: 15000
        });

        // 4. Skicka svaret till frontend
        console.log(`Prediction received from Python API. Total time: ${Date.now() - start}ms`);
        res.json(predictionResponse.data);

    } catch (error) {
        console.error('Error in getAiPrediction:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        const detail = error.response ? error.response.data?.detail || error.message : error.message;
        res.status(500).send({ error: 'Prediction failed', details: detail });
    }
};


// Exportera kitescout-objektet med den tillagda funktionen
module.exports = kitescout;