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
        client_secret:
          process.env.MEETHOUR_CLIENT_SECRET,
        refresh_token:
          tokenStore.refresh_token,
      };
    } else {
      console.log("🆕 USING PASSWORD GRANT");

      payload = {
        grant_type: "password",
        client_id: process.env.MEETHOUR_CLIENT_ID,
        client_secret:
          process.env.MEETHOUR_CLIENT_SECRET,
        username: process.env.MEETHOUR_USERNAME,
        password: process.env.MEETHOUR_PASSWORD,
      };
    }

    const response = await axios.post(
      MEETHOUR_TOKEN_URL,
      payload,
      {
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );

    console.log(
      "✅ TOKEN RESPONSE:",
      response.data
    );

    const tokenData =
      response.data?.data || response.data;

    const access_token =
      tokenData.access_token;

    const refresh_token =
      tokenData.refresh_token;

    const expires_in =
      tokenData.expires_in;

    if (!access_token) {
      throw new Error(
        "Access token missing"
      );
    }

    tokenStore = {
      access_token,
      refresh_token:
        refresh_token ||
        tokenStore.refresh_token,
      expires_at:
        Date.now() + expires_in * 1000,
    };

    console.log("✅ TOKEN STORED");

    return access_token;
  } catch (error) {
    console.log(
      "❌ TOKEN ERROR:",
      error?.response?.data ||
        error.message
    );

    throw error;
  }
}

function generatePasscode(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  return Array.from(
    { length },
    () =>
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ]
  ).join("");
}

app.get("/", (req, res) => {
  console.log("🏠 ROOT HIT");

  res.send("working...");
});

app.post(
  ["/create-meeting", "/api/create-meeting"],
  async (req, res) => {
    console.log(
      "===================================="
    );

    console.log(
      "🔔 CREATE MEETING HIT"
    );

    console.log(
      "📦 RAW BODY:",
      JSON.stringify(req.body, null, 2)
    );

    try {
      const fields =
        req.body.inputFields ||
        req.body.fields ||
        req.body;

      console.log(
        "📥 PARSED FIELDS:",
        JSON.stringify(fields, null, 2)
      );

      const meeting_name = (
        fields.meeting_name || ""
      ).trim();

      const rawDate =
        fields.select_date_for_demo;

      const rawTime =
        fields.provide_available_time;

      const timezone = (
        fields.timezone || ""
      ).trim();

      const email = (
        fields.email || ""
      ).trim();

      console.log(
        "🔍 EXTRACTED VALUES:",
        {
          meeting_name,
          rawDate,
          rawTime,
          timezone,
          email,
        }
      );

      if (
        !meeting_name ||
        !rawDate ||
        !rawTime ||
        !timezone ||
        !email
      ) {
        console.log(
          "❌ REQUIRED FIELDS MISSING"
        );

        return res.status(400).json({
          success: false,
          error:
            "Missing required fields",
        });
      }

      // ======================
      // DATE CONVERSION
      // ======================

      const [mm, dd, yyyy] =
        rawDate.split("/");

      const meeting_date = `${dd}-${mm}-${yyyy}`;

      console.log(
        "📅 FINAL DATE:",
        meeting_date
      );

      // ======================
      // TIME CONVERSION
      // ======================

      const date = new Date(
        parseInt(rawTime)
      );

      let hours =
        date.getUTCHours();

      const minutes = date
        .getUTCMinutes()
        .toString()
        .padStart(2, "0");

      const meeting_meridiem =
        hours >= 12 ? "PM" : "AM";

      hours = hours % 12 || 12;

      const meeting_time = `${hours
        .toString()
        .padStart(2, "0")}:${minutes}`;

      console.log(
        "⏰ FINAL TIME:",
        meeting_time
      );

      console.log(
        "🕐 MERIDIEM:",
        meeting_meridiem
      );

      const token =
        await getValidToken();

      console.log(
        "✅ TOKEN RECEIVED"
      );

      const payload = {
        meeting_name,

        meeting_date,

        meeting_time,

        meeting_meridiem,

        timezone,

        passcode:
          generatePasscode(),

        agenda: `Demo meeting with ${meeting_name}`,

        duration_hr: 1,

        duration_min: 0,

        hostusers: [
          {
            first_name: "Taher",
            last_name: "Ahmed",
            email:
              "taher@meethour.io",
          },
        ],

        attend: [
          {
            first_name:
              meeting_name,
            last_name: "",
            email,
          },
        ],
      };

      console.log(
        "🚀 FINAL PAYLOAD:"
      );

      console.log(
        JSON.stringify(payload, null, 2)
      );

      const response =
        await axios.post(
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
        "✅ MEETHOUR RESPONSE:"
      );

      console.log(
        JSON.stringify(
          response.data,
          null,
          2
        )
      );

      return res.status(200).json({
        success: true,
        data: response.data,
      });
    } catch (error) {
      console.log(
        "🔥 ERROR:"
      );

      console.log(
        error?.response?.data ||
          error.message
      );

      return res.status(500).json({
        success: false,
        error:
          error?.response?.data ||
          error.message,
      });
    }
  }
);

module.exports = app;