import React from 'react';
import ReactDOM from 'react-dom';
import DataStories from './dataStories';

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<DataStories />, div);
  ReactDOM.unmountComponentAtNode(div);
});
