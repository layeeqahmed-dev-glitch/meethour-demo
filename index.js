const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

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
    const now = Date.now();

    if (
        tokenStore.access_token &&
        tokenStore.expires_at &&
        now < tokenStore.expires_at - 60000
    ) {
        return tokenStore.access_token;
    }

    let payload;

    if (tokenStore.refresh_token) {
        payload = {
            grant_type: "refresh_token",
            client_id: process.env.MEETHOUR_CLIENT_ID,
            client_secret: process.env.MEETHOUR_CLIENT_SECRET,
            refresh_token: tokenStore.refresh_token,
        };
    } else {
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

    console.log("TOKEN RESPONSE:", response.data);

    const tokenData = response.data?.data || response.data;

    const access_token = tokenData.access_token;
    const refresh_token = tokenData.refresh_token;
    const expires_in = tokenData.expires_in;

    if (!access_token) {
        throw new Error("Access token missing");
    }

    tokenStore = {
        access_token,
        refresh_token:
            refresh_token || tokenStore.refresh_token,
        expires_at: Date.now() + expires_in * 1000,
    };

    return access_token;
}

function generatePasscode(length = 8) {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    return Array.from(
        { length },
        () =>
            chars[Math.floor(Math.random() * chars.length)]
    ).join("");
}

function convertDate(hubspotDate) {
    const [mm, dd, yyyy] =
        hubspotDate.split("/");

    return `${dd}-${mm}-${yyyy}`;
}

function convertTime(timestamp) {
    if (!timestamp) {
        throw new Error("Invalid timestamp");
    }

    const date = new Date(parseInt(timestamp));

    if (isNaN(date.getTime())) {
        throw new Error("Invalid date");
    }

    let hours = date.getUTCHours();

    const minutes = date
        .getUTCMinutes()
        .toString()
        .padStart(2, "0");

    const meridiem =
        hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    return {
        time: `${hours
            .toString()
            .padStart(2, "0")}:${minutes}`,
        meridiem,
    };
}

app.get("/", (req, res) => {
    res.send("working...");
});

app.post("/create-meeting", async (req, res) => {
    try {
        const fields = req.body.fields || req.body;

        const meeting_name =
            `${fields.firstname || ""} ${fields.lastname || ""
                }`.trim();

        const meeting_date = convertDate(
            fields.select_date_for_demo
        );

        const {
            time: meeting_time,
            meridiem: meeting_meridiem,
        } = convertTime(
            fields.provide_available_time
        );

        const token = await getValidToken();

        const payload = {
            meeting_name,
            meeting_date,
            meeting_time,
            meeting_meridiem,
            timezone: fields.timezone,
            passcode: generatePasscode(),
            agenda: `Demo meeting with ${meeting_name}`,
            duration_hr: 1,
            duration_min: 0,

            hostusers: [
                {
                    first_name: "Taher",
                    last_name: "Ahmed",
                    email: "taher@meethour.io"
                },
                {
                    first_name: "Abdul",
                    last_name: "Muqeet",
                    email: "ab.muqeet@meethour.io"
                },
                {
                    first_name: "Jahan Zaib",
                    last_name: "Faisal",
                    email: "jz.jason@meethour.io"
                },
                {
                    first_name: "Sattar",
                    last_name: "Saif",
                    email: "ab.saif@meethour.io"
                },
                {
                    first_name: "Gopi",
                    last_name: "Yadav",
                    email: "g.yadav@meethour.io"
                }
            ],
            attend: [
                {
                    first_name: fields.firstname || "",
                    last_name: fields.lastname || "",
                    email: fields.email,
                },
            ],
        };

        const response = await axios.post(
            MEETHOUR_API,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type":
                        "application/json",
                },
            }
        );

        console.log(
            "MEETING RESPONSE:",
            response.data
        );

        return res.status(200).json({
            success: true,
            data: response.data,
        });
    } catch (error) {
        console.error(
            "ERROR:",
            error?.response?.data || error.message
        );

        return res.status(500).json({
            success: false,
            error:
                error?.response?.data ||
                error.message,
        });
    }
});

module.exports = app;