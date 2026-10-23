const STATUS = {
	loading: Symbol('loading'),
	loaded: Symbol('loaded'),
	failed: Symbol('failed'),
	noData: Symbol('noData'),
	disabled: Symbol('disabled'),
};

const calcStatusClass = (statusCode) => {
	switch (statusCode) {
		case STATUS.loading:
			return 'loading';
		case STATUS.loaded:
			return 'press-here';
		case STATUS.failed:
			return 'failed';
		case STATUS.noData:
			return 'no-data';
		case STATUS.disabled:
			return 'disabled';
		default:
			return '';
	}
};

const statusClasses = ['loading', 'press-here', 'failed', 'no-data', 'disabled'];

export default STATUS;
export {
	calcStatusClass,
	statusClasses,
};
