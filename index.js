const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

console.log("🚀 SERVER STARTED");

const MEETHOUR_API =
    "https://api.meethour.io/api/v1.2/meeting/schedulemeeting";

const MEETHOUR_TOKEN_URL =
    "https://api.meethour.io/oauth/token";

let tokenStore = {
    access_token: null,
    refresh_token: null,
    expires_at: null,
};

async function getValidToken() {
    try {
        console.log("🔐 GET TOKEN CALLED");

        const now = Date.now();

        if (
            tokenStore.access_token &&
            tokenStore.expires_at &&
            now < tokenStore.expires_at - 60000
        ) {
            console.log("✅ USING CACHED TOKEN");
            return tokenStore.access_token;
        }

        let payload;

        if (tokenStore.refresh_token) {
            console.log("🔄 USING REFRESH TOKEN");
            payload = {
                grant_type: "refresh_token",
                client_id: process.env.MEETHOUR_CLIENT_ID,
                client_secret: process.env.MEETHOUR_CLIENT_SECRET,
                refresh_token: tokenStore.refresh_token,
            };
        } else {
            console.log("🆕 USING PASSWORD GRANT");
            payload = {
                grant_type: "password",
                client_id: process.env.MEETHOUR_CLIENT_ID,
                client_secret: process.env.MEETHOUR_CLIENT_SECRET,
                username: process.env.MEETHOUR_USERNAME,
                password: process.env.MEETHOUR_PASSWORD,
            };
        }

        const response = await axios.post(
            MEETHOUR_TOKEN_URL,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("✅ TOKEN RESPONSE:", response.data);

        const tokenData = response.data?.data || response.data;
        const access_token = tokenData.access_token;
        const refresh_token = tokenData.refresh_token;
        const expires_in = tokenData.expires_in;

        if (!access_token) {
            throw new Error("Access token missing");
        }

        tokenStore = {
            access_token,
            refresh_token: refresh_token || tokenStore.refresh_token,
            expires_at: Date.now() + expires_in * 1000,
        };

        console.log("✅ TOKEN STORED");
        return access_token;
    } catch (error) {
        console.log(
            "❌ TOKEN ERROR:",
            error?.response?.data || error.message
        );
        throw error;
    }
}

function generatePasscode(length = 8) {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(
        { length },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
}

app.get("/", (req, res) => {
    console.log("🏠 ROOT HIT");
    res.send("working...");
});

app.post(
    "/create-meeting",
    async (req, res) => {
        console.log("====================================");
        console.log("🔔 CREATE MEETING HIT");
        console.log("📦 RAW BODY:", JSON.stringify(req.body, null, 2));

        try {
            const fields =
                req.body.inputFields ||
                req.body.fields ||
                req.body;

            console.log("📥 PARSED FIELDS:", JSON.stringify(fields, null, 2));

            const firstName = fields.firstname || "";
            const lastName = fields.lastname || "";
            const email = (fields.email || "").trim();

            // FIX 1: If names don't exist, use email prefix so meeting_name isn't empty/generic
            let meeting_name = `Request a demo with ${firstName} ${lastName}`.trim();

            const rawDate = fields.select_date_for_demo;
            const rawTime = fields.provide_available_time; // Expecting "04:00"
            const timezone = (fields.timezone || "").trim();

            console.log("🔍 EXTRACTED VALUES:", {
                meeting_name,
                rawDate,
                rawTime,
                timezone,
                email,
            });

            if (
                !meeting_name ||
                !rawDate ||
                !rawTime ||
                !timezone ||
                !email
            ) {
                console.log("❌ REQUIRED FIELDS MISSING AT VALIDATION");
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields",
                });
            }

            // ======================
            // FIX 2: CONVERT TIMESTAMP TO DD-MM-YYYY
            // ======================
            const dateObj = new Date(parseInt(rawDate));
            const dd = String(dateObj.getUTCDate()).padStart(2, '0');
            const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
            const yyyy = dateObj.getUTCFullYear();

            const meeting_date = `${dd}-${mm}-${yyyy}`;
            console.log("📅 FINAL DATE:", meeting_date);

            // ======================
            // FIX 3: PARSE "04:00" TIME SAFELY
            // ======================
            let meeting_time = rawTime;
            let meeting_meridiem = fields.meeting_meridiem || "AM";

            // If time contains explicit AM/PM already or needs adjusting to 12h format
            if (rawTime.includes(":")) {
                const [strHours, strMinutes] = rawTime.split(":");
                let hours = parseInt(strHours, 10);

                // If your client sends 24h format and doesn't rely strictly on meeting_meridiem property:
                if (hours >= 12) {
                    meeting_meridiem = "PM";
                    if (hours > 12) hours -= 12;
                } else if (hours === 0) {
                    hours = 12;
                    meeting_meridiem = "AM";
                } else {
                    meeting_meridiem = fields.meeting_meridiem || "AM";
                }
                meeting_time = `${String(hours).padStart(2, '0')}:${strMinutes}`;
            }

            console.log("FINAL TIME:", meeting_time);
            console.log("MERIDIEM:", meeting_meridiem);

            const token = await getValidToken();
            console.log("✅ TOKEN RECEIVED");

            const payload = {
                meeting_name,
                meeting_date,
                meeting_time,
                meeting_meridiem,
                timezone,
                passcode: generatePasscode(),
                agenda: `Requested a demo of Meet Hour with ${firstName} ${lastName}`,
                duration_hr: 1,
                duration_min: 0,
                send_calendar_invite: 1,
                is_show_portal: 1,
                hostusers: [
                    1701,
                    {
                        first_name: "Taher",
                        last_name: "Ahmed",
                        email: "taher@meethour.io",
                    },
                    {
                        first_name: "Jaha zaib",
                        last_name: "Faisal",
                        email: "jz.jason@meethour.io",
                    },
                    {
                        first_name: "Abdul",
                        last_name: "Muqeet",
                        email: "ab.muqeet@meethour.io",
                    },
                    {
                        first_name: "Sattar",
                        last_name: "Saif",
                        email: "ab.saif@meethour.io",
                    },
                    
                    {
                        first_name: "Gopi",
                        last_name: "Yadav",
                        email: "g.yadav@meethour.io",
                    },
                ],
                attend: [
                    {
                        first_name: firstName,   
                        last_name: lastName,     
                        email,                    
                    },
                ],
            };

            console.log("🚀 FINAL PAYLOAD:");
            console.log(JSON.stringify(payload, null, 2));

            const response = await axios.post(
                MEETHOUR_API,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            console.log("✅ MEETHOUR RESPONSE:");
            console.log(JSON.stringify(response.data, null, 2));

            return res.status(200).json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.log("🔥 ERROR:");
            console.log(error?.response?.data || error.message);

            return res.status(500).json({
                success: false,
                error: error?.response?.data || error.message,
            });
        }
    }
);

module.exports = app;