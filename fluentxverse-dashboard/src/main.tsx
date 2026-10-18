import { render } from 'preact';
import { App } from './App';
import './styles/global.css';
import './styles/admin-workspace.css';

render(<App />, document.getElementById('app')!);
