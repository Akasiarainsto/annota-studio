const state={context:null};
export function configureCloudContext(context) {state.context=context;}
export function getCloudContext() {return state.context;}
