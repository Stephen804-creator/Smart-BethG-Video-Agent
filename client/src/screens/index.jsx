import React from 'react';

function Screen({ children, route, name }) {
  return <section className="app-screen" data-screen={name} data-route={route || ''}>{children}</section>;
}

export function GenerateScreen({ children, route }) {
  return <Screen route={route} name="generate">{children}</Screen>;
}

export function ProjectScreen({ children, route }) {
  return <Screen route={route} name="project">{children}</Screen>;
}

export function TimelineScreen({ children, route }) {
  return <Screen route={route} name="timeline">{children}</Screen>;
}

export function LibraryScreen({ children, route }) {
  return <Screen route={route} name="library">{children}</Screen>;
}
