import { assert } from 'chai';
import sinon from 'sinon';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import autoaction from '../../src/autoaction.js';
import TestUtils from 'react-addons-test-utils';

const store = createStore((state) => state);
const wrapInProvider = (Comp) => (<Provider store={store}><Comp /></Provider>);

const FirstTestComponent = (props) => (<div></div>);
const SecondTestComponent = (props) => (<div></div>);
const ParentTestComponent = (props) => (
    <div>
        <FirstTestComponent />
        <SecondTestComponent />
</div>);


describe('Autoaction', () => {
    it("Autoaction decorator should return a function\
    accepting a React component", (done) => {
        const loadSpy = sinon.spy((arg) => ({ type: 'test', payload: arg }));
        const actionCreators = {
            load: loadSpy
        };
        const autoActions = {
            load: (props, state) => [1]
        };
        const decorator = autoaction(autoActions, actionCreators)
        assert.isTrue(typeof decorator === 'function');
        const Wrapper = decorator(FirstTestComponent);
        TestUtils.renderIntoDocument(wrapInProvider(Wrapper));
        done();
    });

    it("Autoaction decorator should accept an object with action names to action\
    arguments mapping and an object with action creators functions and invoke the\
    corresponding action creators with correct arguments", (done) => {
        const loadSpy = sinon.spy((arg) => ({ type: 'test', payload: arg }));
        const actionCreators = {
            load: loadSpy
        };
        const autoActions = {
            load: (props, state) => [1]
        };
        const decorator = autoaction(autoActions, actionCreators);
        const Wrapper = decorator(FirstTestComponent);
        TestUtils.renderIntoDocument(wrapInProvider(Wrapper));
        setTimeout(() => {
            assert.isTrue(loadSpy.calledOnce);
            assert.isTrue(loadSpy.getCall(0).args[0] === 1);
            done();
        }, 50);
    });

    it("Should accept a primitive data type as auto action argument and use that to\
    invoke the action creator", (done) => {
        const loadSpy = sinon.spy((arg) => ({ type: 'test', payload: arg }));
        const actionCreators = {
            load: loadSpy
        };
        const autoActions = {
            load: (props, state) => 1
        };
        const decorator = autoaction(autoActions, actionCreators);
        const Wrapper = decorator(FirstTestComponent);
        TestUtils.renderIntoDocument(wrapInProvider(Wrapper));
        setTimeout(() => {
            assert.isTrue(loadSpy.calledOnce);
            assert.isTrue(loadSpy.getCall(0).args[0] === 1);
            done();
        }, 50);
    });

    it.skip("Should dedupe actions made with the same arguments", (done) => {
        // This test currently fails. It seems like actions are not de-duped
        // due to the key being null in all cases and because of the fact
        // that uniqueness is determined based on the key being not null;
        const loadSpy = sinon.spy((arg) => ({ type: 'test', payload: arg }));
        const actionCreators = {
            load: loadSpy
        };
        const autoActions = {
            load: (props, state) => [1]
        };
        const decorator = autoaction(autoActions, actionCreators);
        const FirstWrapper = decorator(FirstTestComponent);
        const SecondWrapper = decorator(SecondTestComponent);
        const ParentTestComponent = (props) => (
            <div>
                <FirstWrapper />
                <SecondWrapper />
        </div>);
        const ParentWrapper = decorator(ParentTestComponent);
        TestUtils.renderIntoDocument(wrapInProvider(ParentWrapper));
        setTimeout(() => {
            assert.isTrue(loadSpy.calledOnce);
            assert.isTrue(loadSpy.getCall(0).args[0] === 1);
            done();
        }, 50);
    });

    it("Should not call the action creators if any argument returned from autoaction\
    is undefined when autoaction returns an array of arguments", (done) => {
        const loadSpy = sinon.spy((arg) => ({ type: 'test', payload: arg }));
        const actionCreators = {
            load: loadSpy
        };
        const autoActions = {
            load: (props, state) => [true, undefined, true]
        };
        const decorator = autoaction(autoActions, actionCreators);
        const Wrapper = decorator(FirstTestComponent);
        TestUtils.renderIntoDocument(wrapInProvider(Wrapper));
        setTimeout(() => {
            assert.isTrue(loadSpy.callCount === 0);
            done();
        }, 50);
    });

    it("Should not call the action creators if any argument returned from autoaction\
    is undefined when autoaction returns an object", (done) => {
        const loadSpy = sinon.spy((arg) => ({ type: 'test', payload: arg }));
        const actionCreators = {
            load: loadSpy
        };
        const autoActions = {
            load: (props, state) => ({ a: true, b: undefined, c: true })
        };
        const decorator = autoaction(autoActions, actionCreators);
        const Wrapper = decorator(FirstTestComponent);
        TestUtils.renderIntoDocument(wrapInProvider(Wrapper));
        setTimeout(() => {
            assert.isTrue(loadSpy.callCount === 0);
            done();
        }, 50);
    });
});
