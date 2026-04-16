const astroConfig = {"base":"/","root":"file:///Users/temi/codebase/schemabridge/packages/docs/","srcDir":"file:///Users/temi/codebase/schemabridge/packages/docs/src/","build":{"assets":"_astro"},"markdown":{"shikiConfig":{"langs":[]}}};
const ecIntegrationOptions = {"styleOverrides":{"borderColor":"var(--sl-rapide-ui-border-color)","borderRadius":"0.5rem","frames":{"editorActiveTabIndicatorBottomColor":"var(--sl-color-gray-3)","editorActiveTabIndicatorTopColor":"unset","editorTabBarBorderBottomColor":"var(--sl-rapide-ui-border-color)","frameBoxShadowCssValue":"unset"},"textMarkers":{"backgroundOpacity":"40%","markBackground":"var(--sl-rapide-ec-marker-bg-color)","markBorderColor":"var(--sl-rapide-ec-marker-border-color)"}},"themes":["vitesse-dark","vitesse-light"]};
let ecConfigFileOptions = {};
try {
	ecConfigFileOptions = (await import('./ec-config_CzTTOeiV.mjs')).default;
} catch (e) {
	console.error('*** Failed to load Expressive Code config file "file:///Users/temi/codebase/schemabridge/packages/docs/ec.config.mjs". You can ignore this message if you just renamed/removed the file.\n\n(Full error message: "' + (e?.message || e) + '")\n');
}

export { astroConfig, ecConfigFileOptions, ecIntegrationOptions };
