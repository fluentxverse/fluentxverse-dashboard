import { render } from 'preact';
import { App } from './App';
import './styles/global.css';
import './styles/admin-workspace.css';
import './styles/admin-theme.css';

render(<App />, document.getElementById('app')!);
