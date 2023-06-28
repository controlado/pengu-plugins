/**
 * @author
 * Nome: Yan Gabriel    
 * Discord: Balaclava#1912 (854886148455399436)    
 * GitHub: https://github.com/controlado
 */

const clientAuthRegex = /^--riotclient-auth-token=(.+)$/;
const clientPortRegex = /^--riotclient-app-port=([0-9]+)$/;

/**
 * Rotinas que são chamadas periodicamente. 
 * 
 * @constant
 * @default
*/
export const routines = [];

/**
 * Fase em que o jogo está, por exemplo: ChampionSelect
 * 
 * @constant
 * @default
 * @see {@link linkEndpoint} (/lol-gameflow/v1/gameflow-phase)
 */
export let gamePhase = null;

/**
 * Credenciais do client que são atualizadas posteriormente.
 * 
 * @constant
 * @default
 * @see {@link fetchClientCredentials} a função que atualiza essas credenciais.
 */
export const credentials = { auth: null, port: null };

async function fetchClientCredentials() {
    const response = await fetch("/riotclient/command-line-args");
    const responseData = await response.json();

    for (const element of responseData) {
        const authMatch = element.match(clientAuthRegex);
        const portMatch = element.match(clientPortRegex);

        if (authMatch) {
            credentials.auth = authMatch[1];
        }

        if (portMatch) {
            credentials.port = parseInt(portMatch[1], 10);
        }
    }
}

async function watchRoutines() {
    while (true) {
        for (const routine of routines) {
            routine();
        }
        await sleep(1000);
    }
}

/**
 * Faz o código dormir por um tempo específico.
 * 
 * @async
 * @function
 * @param {Number} ms - Milissegundos que a função vai dormir.
 * @return {Promise<Number>} Retorno do uso de setTimeout.
 */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Adiciona funções que vão ser chamadas periodicamente.
 * 
 * @async
 * @function
 * @param {CallableFunction[]} callbacks - Funções que vão ser adicionadas.
 */
export function addRoutines(...callbacks) { routines.push(...callbacks) };

/**
 * Linka um endpoint a uma função.
 * 
 * @async
 * @function
 * @summary Quando o endpoint for atualizado, {@link callback} vai ser chamado recebendo seus dados.
 * @param {string} rawEndpoint - Endpoint que vai ser linkado a função.
 * @param {CallableFunction} callback - Função que vai ser chamada no evento do endpoint.
 */
export function linkEndpoint(rawEndpoint, callback) {
    const riotWebsocket = document.querySelector(`link[rel="riot:plugins:websocket"]`);
    const webSocket = new WebSocket(riotWebsocket.href, "wamp");
    const endpoint = rawEndpoint.replaceAll("/", "_");

    webSocket.onopen = () => {
        const value = [5, "OnJsonApiEvent" + endpoint];
        webSocket.send(JSON.stringify(value));
    };

    webSocket.onmessage = (messageEvent) => {
        const parsedMessageEvent = JSON.parse(messageEvent.data);
        callback({ data: parsedMessageEvent[2], rawEvent: parsedMessageEvent });
    };
}

function init() {
    fetchClientCredentials();
    watchRoutines();
    linkEndpoint("/lol-gameflow/v1/gameflow-phase", (messageEvent) => { gamePhase = messageEvent.data.data });
}

window.addEventListener("load", init);
