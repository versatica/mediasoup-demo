import * as pokemon from 'pokemon';

export default function()
{
	const lang = detectLanguage();

	return pokemon.random(lang);
}

// TODO: pokemon lib does not work with browserify (it just loads 'en' language)
// so let's just use 'en'.
//
// https://github.com/versatica/mediasoup-demo/issues/45
function detectLanguage()
{
	return 'en';

	// const lang = (
	// 	(navigator.languages && navigator.languages[0]) ||
	// 	navigator.language ||
	// 	navigator.userLanguage
	// );

	// if (!lang)
	// 	return 'en';

	// if (/^en/i.test(lang))
	// 	return 'en';
	// else if (/^de/i.test(lang))
	// 	return 'de';
	// else if (/^fr/i.test(lang))
	// 	return 'fr';
	// else if (/^ja/i.test(lang))
	// 	return 'ja';
	// else if (/^ko/i.test(lang))
	// 	return 'ko';
	// else if (/^ru/i.test(lang))
	// 	return 'ru';
	// else if (/^de/i.test(lang))
	// 	return 'de';
	// else
	// 	return 'en';
}
