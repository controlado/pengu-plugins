import axios from "https://cdn.skypack.dev/axios";

/**
 * @author
 * Nome: Yan Gabriel
 * Discord: Balaclava#1912 (854886148455399436)
 * GitHub: https://github.com/controlado
 */

const clientAuthRegex = /^--riotclient-auth-token=(.+)$/;
const clientPortRegex = /^--riotclient-app-port=([0-9]+)$/;

/**
 * Rotinas chamadas periodicamente.
 *
 * @constant
 * @default
 */
export const routines = [];

/**
 * Credenciais do client que são atualizadas posteriormente.
 *
 * @constant
 * @default
 * @see {@link fetchClientCredentials} a função que atualiza essas credenciais.
 */
export const credentials = {auth: null, port: null};

/**
 * Fase em que o jogo está, por exemplo: ChampionSelect
 *
 * @var
 * @default
 * @see {@link linkEndpoint} (/lol-gameflow/v1/gameflow-phase)
 */
export let gamePhase = null;

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
 * Possibilita requisições a loja do usuário autenticado.
 */
export class StoreBase {
    constructor() {
        this.url = null;
        this.token = null;
        this.summoner = null;
        this.session = axios.create();
        this.auth();
    }

    /**
     * Faz uma requisição para a loja.
     *
     * @async
     * @function
     * @summary Deve ser chamada após a conclusão do {@link auth}.
     * @param {String} method - Método HTTP da requisição, como `GET`.
     * @param {String} endpoint - Endpoint da requisição para a loja.
     * @param {JSON} [requestBody] - Parâmetro opcional, corpo da requisição.
     * @return {Promise<Response>} Resposta da requisição.
     */
    async request(method, endpoint, requestBody = undefined) {
        const requestParams = {
            method: method,
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        };
        if (requestBody) requestParams.data = requestBody;
        return await this.session.request(this.url + endpoint, requestParams);
    }

    /**
     * Autentica a classe, definindo os atributos da instância.
     *
     * @async
     * @function
     * @summary Essa função deve ser chamada antes de utilizar a classe.
     */
    async auth() {
        this.url = await this.getStoreUrl();
        this.token = await this.getSummonerToken();
        this.summoner = await this.getSummonerData();
    }

    async getStoreUrl() {
        const response = await fetch("/lol-store/v1/getStoreUrl");
        return await response.json();
    }

    async getSummonerToken() {
        const response = await fetch("/lol-rso-auth/v1/authorization/access-token");
        const responseData = await response.json();
        return responseData.token;
    }

    async getSummonerData() {
        const response = await fetch("/lol-summoner/v1/current-summoner");
        return await response.json();
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
export function addRoutines(...callbacks) { routines.push(...callbacks); }

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
        callback({data: parsedMessageEvent[2], rawEvent: parsedMessageEvent});
    };
}

function init() {
    fetchClientCredentials();
    watchRoutines();
    linkEndpoint("/lol-gameflow/v1/gameflow-phase", (messageEvent) => gamePhase = messageEvent.data.data);
}

window.addEventListener("load", init);
