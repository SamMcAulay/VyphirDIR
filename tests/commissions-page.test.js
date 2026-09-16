import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Commissions, { CommissionsContent } from '../src/pages/Commissions.jsx';

const page = renderToStaticMarkup(<Commissions />);

const DATA = {
    status: true,
    intro: 'Reach out on discord\nor Insta <3',
    specialOffer: '',
    tiers: [{ name: 'Lined Headshots', price: '€10+', description: 'Simple line art', example: 'https://example.com/t.png' }],
    pastWork: [{ url: 'https://example.com/p.png', caption: 'Comm for Owen' }],
};

test('wraps the page in the honey page frame with a hidden heading', () => {
    assert.match(page, /^<div class="page-honey page-frame"><h1 class="sr-only">Commissions<\/h1>/);
});

test('renders no panel, back link or queue and terms buttons', () => {
    assert.doesNotMatch(page, /panel-wrapper|back-link|link-btn/);
});

test('renders nothing data-dependent before the fetch lands', () => {
    assert.doesNotMatch(page, /status-sticker/);
});

test('shows an open sticker when commissions are open', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={DATA} />);
    assert.match(html, /<p class="status-sticker status-sticker--open">.*<span class="status-sticker__text">Commissions open!<\/span><\/p>/s);
});

test('shows a closed sticker when commissions are closed', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={{ ...DATA, status: false }} />);
    assert.match(html, /status-sticker--closed/);
    assert.match(html, /Commissions closed/);
});

test('renders the intro and only renders the special offer when there is one', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={DATA} />);
    assert.match(html, /<p class="commissions-intro__text">Reach out on discord\nor Insta &lt;3<\/p>/);
    assert.doesNotMatch(html, /commissions-offer/);
    const offer = renderToStaticMarkup(<CommissionsContent data={{ ...DATA, specialOffer: 'Half price icons' }} />);
    assert.match(offer, /<p class="commissions-offer">Half price icons<\/p>/);
});

test('renders the tiers and a past work heading when there is past work', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={DATA} />);
    assert.match(html, /Lined Headshots/);
    assert.match(html, /<h2 class="past-work-title">Past work<\/h2>/);
});

test('omits the past work heading when there is none', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={{ ...DATA, pastWork: [] }} />);
    assert.doesNotMatch(html, /past-work/);
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(renderToStaticMarkup(<CommissionsContent data={DATA} />), /style=/);
});
