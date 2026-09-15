/**
 * The renderer entry for the desktop view.
 *
 * Same plugin, same panes, same commands; no native loader. Every call the
 * panes make goes through `ibkrGatewayManager`, whose facade uses the host's
 * remote broker client when one is present, so the socket the Bun process
 * opened is what answers.
 */
export { ibkrGatewayPlugin } from "./plugin";
export { default } from "./plugin";
