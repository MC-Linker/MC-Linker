import { Canvas, loadImage } from 'skia-canvas';

const colorCodes = {
    0: '#000',
    1: '#00A',
    2: '#0A0',
    3: '#0AA',
    4: '#A00',
    5: '#A0A',
    6: '#FA0',
    7: '#AAA',
    8: '#555',
    9: '#55F',
    a: '#5F5',
    b: '#5FF',
    c: '#F55',
    d: '#F5F',
    e: '#FF5',
    f: '#FFF',
};
const formattingCodes = ['l', 'm', 'n', 'o', 'r', 'k', 'x'];

/**
 * Parses a string with minecraft color codes and formatting and draws it on a canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {string} text - The text to draw.
 * @param {number} x - The x position to start drawing at.
 * @param {number} y - The y position to start drawing at.
 * @param {boolean} [drawShadow=false] - Whether to draw a shadow.
 */
export function drawMinecraftText(ctx, text, x, y, drawShadow = false) {
    const originalFont = ctx.font;
    ctx.save();

    let strikethrough = false;
    let underline = false;
    let obfuscated = false;
    for(let i = 0; i < text.length; i++) {
        let char = text.charAt(i);

        const colorCodeRegex = /§([0-9a-fk-orx])/i;
        const match = (char + text.charAt(i + 1)).match(colorCodeRegex);
        if(match) {
            const [_, color] = match;

            if(colorCodes[color.toLowerCase()]) {
                ctx.fillStyle = colorCodes[color.toLowerCase()];
                //Color codes reset formatting
                strikethrough = false;
                underline = false;
                obfuscated = false;
            }
            else if(formattingCodes.includes(color.toLowerCase())) {
                switch(color) {
                    case 'l':
                        ctx.font = `bold ${originalFont}`;
                        break;
                    case 'o':
                        ctx.font = `italic ${originalFont}`;
                        break;
                    case 'm':
                        strikethrough = true;
                        underline = false;
                        break;
                    case 'n':
                        underline = true;
                        strikethrough = false;
                        break;
                    case 'k':
                        obfuscated = true;
                        break;
                    case 'r':
                        ctx.fillStyle = '#AAA';
                        ctx.font = `normal ${originalFont}`;
                        strikethrough = false;
                        underline = false;
                        obfuscated = false;
                        break;
                    case 'x':
                        //Get the next 12 characters, remove the § and parse the hex color
                        // §x§f§f§0§0§0§0
                        const hex = text.substring(i + 2, i + 14).replace(/§/g, '');
                        ctx.fillStyle = `#${hex}`;
                        i += 12;
                }
            }

            i++; //Skip next char
            continue;
        }

        if(obfuscated && char !== ' ') char = '?';

        if(drawShadow) {
            const previousFillStyle = ctx.fillStyle;
            const shadowOffset = ctx.measureText(char).width / 5;

            ctx.fillStyle = '#3E3E3E';
            ctx.fillText(char, x + shadowOffset, y + shadowOffset);
            ctx.fillStyle = previousFillStyle;
        }

        ctx.fillText(char, x, y);

        if(strikethrough) ctx.fillRect(x, y - 8, ctx.measureText(char).width, 4);
        if(underline) ctx.fillRect(x, y + 4, ctx.measureText(char).width, 4);

        x += ctx.measureText(char).width;
    }

    ctx.restore();
}

const mcNumbers = await loadImage('./resources/images/misc/numbers.png');
const mcDigitSize = [5, 7];

/**
 * Draws a minecraft number on a canvas.
 * @param {import('skia-canvas').CanvasRenderingContext2D} context - The canvas context to draw on.
 * @param {int|string} num - The number to draw.
 * @param {int} x - The x position to start drawing at.
 * @param {int} y - The y position to start drawing at.
 * @param {int} width - The width of each digit.
 * @param {int} height - The height of each digit.
 */
export function drawMinecraftNumber(context, num, x = 0, y = 0, width, height) {
    num = num.toString();

    const shadowOffset = width / mcDigitSize[0];

    const canvas = new Canvas((width + shadowOffset) * num.length, height + shadowOffset);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    //Draw shadow
    for(let i = 0; i < num.length; i++)
        ctx.drawImage(mcNumbers, num[i] * mcDigitSize[0], 0, mcDigitSize[0], mcDigitSize[1], i * (width + shadowOffset) + shadowOffset, shadowOffset, width, height);

    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#3E3E3E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'source-over';
    //Draw number
    for(let i = 0; i < num.length; i++)
        ctx.drawImage(mcNumbers, num[i] * mcDigitSize[0], 0, mcDigitSize[0], mcDigitSize[1], i * (width + shadowOffset), 0, width, height);

    context.drawImage(canvas, x, y);
}

/**
 * Divide an entire phrase in an array of phrases, all with the max pixel length given.
 * The words are initially separated by the space char.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {string} text - The text to draw.
 * @param {number} maxWidth - The max width of the text.
 * @returns {string[]} - The divided phrases.
 */
export function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];

    let currentLine = words[0];
    for(const word of words) {
        if(word === words[0]) continue; //Skip first word
        const width = ctx.measureText(`${currentLine} ${word}`).width;
        if(width < maxWidth) currentLine += ` ${word}`;
        else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}
