// "F1" in the page titles is the Formula 1 logo (supplied by the owner, without the TM mark): white on the F1 screens
// (images/f1-logo.svg), in its own red on the F1 News page (images/f1-logo-red.svg)
const logo = (red) => `<img class="f1-logo" src="images/${red ? 'f1-logo-red' : 'f1-logo'}.svg" alt="F1" />`;

// a title that starts with F1: the logo, then the rest (text of this project, not from other sites: it goes in as HTML)
const f1Title = (rest, red = false) => `${logo(red)}${rest}`;

export default f1Title;
