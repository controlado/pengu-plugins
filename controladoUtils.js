import axios from "https://cdn.skypack.dev/axios";

/**
 * @author balaclava
 * @name controlado-utils
 * @link https://github.com/controlado/pengu-plugins
 * @description Functions and dependencies of the @controlado plugins
 */

const clientAuthRegex = /^--riotclient-auth-token=(.+)$/;
const clientPortRegex = /^--riotclient-app-port=(\d+)$/;

/**
 * Rotinas chamadas periodicamente.
 *
 * @constant
 * @type {function[]}
 * @see {@link watchRoutines} que executa as rotinas.
 */
export const routines = [];

/**
 * Credenciais do client que são atualizadas posteriormente.
 *
 * @constant
 * @type {Object}
 * @see {@link fetchClientCredentials} a função que atualiza essas credenciais.
 */
export const credentials = { auth: null, port: null };

/**
 * Fase em que o jogo se encontra.
 *
 *
 * @var
 * @type {"None" | "Lobby" | "Matchmaking" | "ReadyCheck" | "ChampSelect" | "InProgress" | "GameStart"}
 * @see {@link linkEndpoint} - retorna essa informação usando "/lol-gameflow/v1/gameflow-phase".
 */
export let gamePhase;

/**
 * Elemento que contém alguns elementos da interface do usuário.
 * 
 * @var
 * @type {HTMLElement}
 * @see {@link setLayerManager} - define esse elemento.
 */
export let layerManager;

/**
 * Modo de testes do módulo.
 *
 * @var
 * @type {boolean}
 */
export let debug = false;

/**
 * Uma classe usada para identificar um campeão.
 */
export class Champion {
  /**
   * @param {number} id
   * @param {number} ipCost
   */
  constructor(id, ipCost) {
    this.id = id;
    this.ipCost = ipCost;
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
   * Compra os campeões requisitados.
   *
   * @param {...Champion} champions - Campeões que vão ser comprados.
   * @return {Promise<Response>} Resposta da requisição.
   */
  buyChampions(...champions) {
    const items = champions.map(
      champion => (
        {
          inventoryType: "CHAMPION",
          itemId: champion.id,
          ipCost: champion.ipCost,
          quantity: 1,
        }
      ),
    );
    const body = { accountId: this.summoner.accountId, items: items };
    return this.request("POST", "/storefront/v3/purchase", body);
  }

  /**
   * Faz uma requisição para a loja.
   *
   * @async
   * @function
   * @summary Deve ser chamada após a conclusão do {@link auth}.
   * @param {"GET" | "POST" | "PUT" | "DELETE"} method - Método HTTP da requisição.
   * @param {string} endpoint - Endpoint da requisição para a loja.
   * @param {Object} [body] - Parâmetro opcional, corpo da requisição.
   * @return {Promise<Response>} Resposta da requisição.
   */
  request(method, endpoint, body = undefined) {
    const requestParams = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      ...body && { data: body },
    };
    return this.session.request(this.url + endpoint, requestParams);
  }

  /**
   * Autentica a classe, definindo os atributos da instância.
   *
   * @async
   * @function
   * @summary Essa função deve ser chamada antes de utilizar a classe.
   */
  async auth() {
    const promises = [this.getStoreUrl(), this.getSummonerToken(), this.getSummonerData()];
    [this.url, this.token, this.summoner] = await Promise.all(promises);

    if (debug) {
      console.log(this.url, this.token, this.summoner);
    }
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
 * Função que realiza uma requisição utilizando a função fetch.
 *
 * @async
 * @function
 * @param {"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD"} method - Método HTTP da requisição.
 * @param {string} endpoint - Endpoint da requisição para a API.
 * @param {Object} [options] - As opções da requisição.
 * @param {Object} [options.headers] - Os cabeçalhos da requisição.
 * @param {Object} [options.body] - O corpo da requisição.
 * @param {Object} [options.params] - Parâmetros da requisição.
 * @returns {Promise<Response>} Resposta da requisição.
 */
export function request(method, endpoint, { headers, body, params } = {}) {
  const requestOptions = {
    method,
    headers: {
      ...headers,
      "accept": "application/json",
      "content-type": "application/json",
    },
    ...body && { body: JSON.stringify(body) },
  };

  if (params) {  // query parameters
    endpoint += "?" + new URLSearchParams(params).toString();
  }

  return fetch(endpoint, requestOptions);
}

/**
 * Envia uma notificação no chat da seleção de campeões.
 *
 * @async
 * @function
 * @param {string} notification - Notificação que vai ser enviada.
 * @return {Promise<Response>} Resposta da requisição.
 */
export async function sendChatNotification(notification) {
  const { participants } = await getChampionSelectParticipants();
  const { cid } = participants[0];

  const body = { body: notification, type: "celebration" };
  const endpoint = `/lol-chat/v1/conversations/${cid}/messages`;
  return request("POST", endpoint, { body });
}

/**
 * Retorna os dados dos participantes da seleção de campeões.
 * 
 * @async
 * @function
 * @returns {Promise<Object>} Dados dos participantes da seleção de campeões.
 */
export async function getChampionSelectParticipants() {
  const response = await request("GET", "//riotclient/chat/v5/participants/champ-select");
  return await response.json();
}

/**
 * Faz o código dormir por um tempo específico.
 *
 * @async
 * @function
 * @param {number} ms - Milissegundos que a função vai dormir.
 * @return {Promise<number>} Retorno do uso de setTimeout.
 */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Adiciona funções que vão ser chamadas periodicamente.
 *
 * @async
 * @function
 * @param {...function} callbacks - Funções que vão ser adicionadas.
 * @return {number} Quantidade atual de rotinas carregadas.
 */
export function addRoutines(...callbacks) { return routines.push(...callbacks); }

/**
 * @typedef {Object} ParsedEventData
 * @property {any} data - Os dados do evento recebido.
 * @property {string} uri - A URI do evento recebido.
 * @property {string} eventType - O tipo de evento recebido.
 */

/**
 * Conecta um endpoint a uma função.
 *
 * @async
 * @function
 * @summary Quando o endpoint for atualizado, {@link callback} será chamado recebendo seus dados.
 * @example
 * function phaseHandler(parsedEvent) {
 *   if (parsedEvent.data === "ChampSelect") {
 *     console.log("Yep! Estamos na seleção de campeão!");
 *   }
 * }
 *
 * linkEndpoint("/lol-gameflow/v1/gameflow-phase", phaseHandler);
 * @param {string} rawEndpoint - Endpoint que será conectado à função.
 * @param {function} callback - Função que será chamada no evento do endpoint.
 * @param {ParsedEventData} callback.parsedEvent - Evento analisado recebido do endpoint.
 * @param {MessageEvent} callback.rawEvent - Objeto MessageEvent contendo os detalhes do evento recebido.
 */
export function linkEndpoint(rawEndpoint, callback) {
  const riotWebsocket = document.querySelector(`link[rel="riot:plugins:websocket"]`);
  const webSocket = new WebSocket(riotWebsocket.href, "wamp");
  const endpoint = rawEndpoint.replaceAll("/", "_");

  webSocket.onopen = () => webSocket.send(JSON.stringify([5, "OnJsonApiEvent" + endpoint]));
  webSocket.onmessage = messageEvent => callback(JSON.parse(messageEvent.data)[2], messageEvent);
}

/**
 * Retorna o elemento HTML que corresponde ao XPath especificado.
 *
 * @param {string} path - XPath do elemento.
 * @return {HTMLElement} Elemento HTML que corresponde ao XPath especificado.
 */
export function getElementByXpath(path) {
  const result = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

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

  if (debug) {
    console.log(credentials);
  }
}

async function watchRoutines() {
  for (const routine of routines) {
    routine(); // ideal que seja síncrono
  }
  setTimeout(watchRoutines, 1000);
}

/**
 * Inicializa a variável global {@link gamePhase} com o valor atual da fase do jogo.
 *
 * @async
 * @function
 * @summary Útil para casos onde o script é carregado após o jogo já ter iniciado.
 */
async function setGamePhase() {
  while (gamePhase === undefined) {
    await sleep(500);

    const response = await request("GET", "/lol-gameflow/v1/gameflow-phase");
    gamePhase = await response.json(); // pode ser: None, Lobby, Matchmaking, ReadyCheck, ChampSelect...

    if (debug) {
      console.log(gamePhase);
    }
  }
}

async function setLayerManager() {
  while (!layerManager) {
    layerManager = document.querySelector("#lol-uikit-layer-manager-wrapper");
    await sleep(500);

    if (debug) {
      console.log(layerManager);
    }
  }
}

function init() {
  setGamePhase();
  setLayerManager();
  fetchClientCredentials();
  linkEndpoint("/lol-gameflow/v1/gameflow-phase", parsedEvent => gamePhase = parsedEvent.data);

  if (debug) {
    linkEndpoint("", parsedEvent => console.log(parsedEvent.uri, parsedEvent.data));
    window.getGamePhase = () => gamePhase;
    window.LCURequest = request;
    window.LCUSleep = sleep;
  }

  watchRoutines();
}

window.addEventListener("load", init);
