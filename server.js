require('dotenv').config()

const puppeteer = require("puppeteer");
const sharp = require("sharp")
const { Client, GatewayIntentBits, ActivityType, Events, MessageAttachment } = require('discord.js');
const Bot = new Client({ intents: [GatewayIntentBits.GuildMessages] });

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

Bot.on(Events.ClientReady, () => {
    console.log("Bot is up and running !");
    Bot.user.setActivity('Calendar by Fab', {type: ActivityType.Streaming, url: "https://twitch.tv/fabuss255"})

    Bot.application.commands.set([
        {
            name: 'getcalendar',
            description: 'Retrieve the current week\'s calendar for devs',
        },
    ])
})

Bot.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === 'test') {
		await interaction.reply({ content: 'Secret Pong!', ephemeral: true });
	}else if(interaction.commandName == "getcalendar"){
        await GetCalendar(interaction);
    }
});

let LastRequest = 0;
async function GetCalendar(interaction) {
    await interaction.deferReply();

    if (LastRequest + 3600000 > Date.now()){
        return await interaction.editReply({files: ["export/Calendar.png"]});
    }
    LastRequest = Date.now();

    console.log("Generating")

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Resize for screenshot quality
    page.setViewport({
        width: 1080,
        height: 720,
        deviceScaleFactor: 1,
    });

    await page.goto(process.env.url);

    // Type into search box.
    await page.type('#username', process.env.email);
    await page.type('#password', process.env.password);

    // Wait for suggest overlay to appear and click "show all results".
    await page.click(".form > .button");

    // Allow JS
    await page.setJavaScriptEnabled(true);

    // Wait for the name to appear (which mean loading finished)
    await page.waitForSelector(".ibe_etab");

    // Wait for the results page to load and display the results. 
    await page.waitForSelector(".interface_affV_client")

    await page.screenshot({
        path: "export/CalendarUncropped.png",
    });
    console.log("Fetched screenshot !")
    
    await browser.close();

    await sharp("export/CalendarUncropped.png").extract({ left: 6, top: 224, width: 1069, height: 441}).toFile("export/Calendar.png")
    console.log("Calendar is now ready for usage !");

    return await interaction.editReply({files: ["export/Calendar.png"]});
}

Bot.login(process.env.token);