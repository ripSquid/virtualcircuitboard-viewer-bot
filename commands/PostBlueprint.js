const { SlashCommandBuilder } = require('@discordjs/builders');
const sharp = require('sharp')
const zstd = require('@xingrz/cppzst');
const { MessageAttachment, MessageEmbed } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postblueprint')
        .setDescription('Creates embed with your blueprint')
        .addSubcommand(subcommand =>
            subcommand.setName('text')
                .setDescription('Blueprint in text format')
                .addStringOption(option =>
                    option.setName('blueprint-code')
                        .setDescription('Your blueprint code from VCB')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of your blueprint creation')))
        .addSubcommand(subcommand =>
            subcommand.setName('file')
                .setDescription('Blueprint in text file format')
                .addAttachmentOption(option =>
                    option.setName('blueprint-code')
                        .setDescription('Your blueprint code from VCB in a text file')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of your blueprint creation'))),
    
                        async execute(interaction) {
        switch (interaction.options.getSubcommand()) {
            case 'text':
                // Get blueprint base64 from command    
                let blueprint_data = Buffer.from(interaction.options.getString('blueprint-code').replace(/\r?\n|\r/g, ""), 'base64');

                // Run function which extracts image dimension, turns data into png format and scales it.
                // After that we make it into a discord message attachment
                let file_1 = new MessageAttachment(await createBlueprintImage(blueprint_data, interaction), "output.png")

                // Default name is Blueprint and set it to provided name if available
                let name = "Blueprint"
                if (interaction.options.getString('name') != null) name = interaction.options.getString('name')
                
                // Create embed with image and previous name set
                let embed_1 = new MessageEmbed()
                    .setTitle(name)
                    .setImage('attachment://output.png')

                // Send embed in the channel which the command was sent and privately notify the sender of the command
                await interaction.channel.send({ embeds: [embed_1], files: [file_1] })
                await interaction.reply({ content: 'Done!', ephemeral: true }); // Private notify
                return
            case 'file':
                // Get attached file in the command
                let blueprint_file = interaction.options.getAttachment("blueprint-code")
                
                // Download the file from discord and use the text from it ( TODO: CHECK FILE FORMAT )
                blueprint_file = await fetch(blueprint_file.url).then(f => f.text())
                
                // Turn base64 data into binary data
                blueprint_file = Buffer.from(blueprint_file, 'base64') 

                // Same as above
                let file_2 = new MessageAttachment(await createBlueprintImage(blueprint_file, interaction), "output.png")
                let embed_2 = new MessageEmbed()
                    .setTitle('Name')
                    .setImage('attachment://output.png')

                await interaction.channel.send({ embeds: [embed_2], files: [file_2] })
                await interaction.reply({ content: 'Done!', ephemeral: true });

                return
            default:
                return
        }
    },
};

async function createBlueprintImage(blueprint_data, interaction) {
    // Checks if provided data is atleast larger than the footer which is always there
    if (blueprint_data.length < 32) { await interaction.reply({ content: 'Provided blueprint is invalid', ephemeral: true }); return };
    
    // Reads little endian number at a specific location for height and width of the image
    height = blueprint_data.readInt32LE(blueprint_data.length - 28)
    width = blueprint_data.readInt32LE(blueprint_data.length - 20)

    // Take all other data which isn't the footer
    let compressed_image_data = blueprint_data.slice(0, blueprint_data.length - 32)
    // Decompress it
    let uncompressed_image_data = await zstd.decompress(compressed_image_data)
    // Turn said data into an image and scale it
    let image = sharp(uncompressed_image_data, {
        raw: {
            width: width,
            height: height,
            channels: 4
        }
    }).resize(width * 5, height * 5, { kernel: "nearest" }).png()

    // Turn image into buffer and return
    let image_buffer = await image.toBuffer()
    return image_buffer
}