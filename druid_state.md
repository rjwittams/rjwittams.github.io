# State in Druid widgets

## Overview
First a quick overview - this is not meant to cover the entirety of Druid, just the relevant points

Druid widget methods can be dependent on state from the following places:

| Place       | Mutable? | Limitations                  | Notes
| ------------|----------|------------------------------|------------------------------
| self        | Always   | None                         | Main widget methods are &mut self.
| app data    | In event* | Must impl Data              | Data values are cloned and compared by WidgetPod.  
| env         | Never    | Must be containable in Value | EnvScope can "port" data into the env of its children. 
| context     | Via negotiation | Library defined       | e.g size, viewport_offset

*If you want to mutate app data in another method, send self a command that does the mutation (possibly queueing the update in self).

The lifecycle of druid methods is as follows:

Event->Update?->Layout?->Paint>? 

Lifecycle events also occur but each one is specialised. The most relevant to this discussion is WidgetAdded, which should occur before anything else. 

| Method                  | Why is it called                                                         
| ------------------------|--------------------------------------------------------------------------
| lifecycle (WidgetAdded) | Your widget was added to the hierarchy, and children_changed was called  
| event                   | a user action, internal event, or command is probably relevant to this widget or its children
| update                  | Your parent (WidgetPod, or LensWrap, or.. ) thinks your data has changed or request_update was called
| layout                  | layout has never happened, or request_layout was called 
| paint                   | paint has never happened, or request_paint was called

When should you call the various request_* methods? (Just covering the ones that cause your own methods to be called).

| Request method | When to call |
| -------------- | -----------  | 
| request_update | Only if synthesizing data , like Scope. Your caller (WidgetPod, LensWrap) should detect other changes |
| request_layout | When some state that you depend on in layout changes. | 
| request_paint  | When some state that you depend on in paint changes.  |
| request_paint_rect | (Advanced) When some state that you depend on in paint changes, and you can pinpoint the relevant rect. Useful for containers|


## Observations 

From the widget authors point of view, there are a couple of decisions to be made related to state: 

- Where should my state live? 
- When do I call request_* (i.e tracking depenedencies)

Currently, the general thought process is : 
- What is my widget "about"? That should be its data. The framework will handle reactivity of this, 
  by calling update whenever it changes, be that up or down the hierarchy. For example: A text box is about text. So a string (Rope?) is its data. 
- What other choices do constructors of my widget have to make? The data that embodies those choices will be stored in self, 
  and will come in via constructor arguments or build methods, and will often default to something from Env. 
  This will not be reactive, either up or down the heirarchy. For example: the text color of a label. 
  It may be possible for my owner to access this information. 
- What other state do I have to maintain? That will go in self. For example: the scroll positions of a Scroll. 
  This will not be reactively available up or down the heirarchy. 
  
The main issue here is what I call the "single binding problem". 
- Only data works reactively. 
- If you pick the 'natural' bit of information that your widget is about, other options will not be available reactively. 
  Eg with a label, making text colour or font size reactive as well as the label contents. 
- If you make the full state of the widget (or more of it) into your data: 
  - Everything must now be Data
  - Your caller must now be able to create your full state, or it must be lensable from your AppData.

So the widget author has to make decisions that limit the choices we would like to give Widget consumers: 
   - What parts of this widget are reactive?
   - Where does the state backing this property live (ie which other widgets should be able to share it and when should it be dropped)? 

# Possible partial solutions: 

## View switcher
** What is it? **  A wrapper widget will recreate the widget from data and env each time the relevant parts change               
** What do you get? **  Constructor args etc can be made reactive 
** Limitations ** Any state that you do not or cannot extract from the widget will be lost. 
  Identity will be lost if not manually maintained. A bit more manual dependency tracking is required.


## Scope        
** What is it? **  Your widget can put more state into data, without polluting app data. A wrapper widget will maintain a two way link.
** What do you get? **  Identity and private state maintained. Multiple sibling widgets can reactively share encapsulated state.
** Limitations ** Your 'real' widget(s) will likely need to be wrapped by a scope and another wrapper to set up the scope. 

## Bindings 
** What is it? ** A wrapper widget (BindingHost) that gives you one or two way transfer of information between data and self. Env should be doable. 
                  (This can include everything inside a scope, because a scopes state is kept in the self of the Scope widget.)
                  The wrapper reach past lenses and other type preserving wrappers to access the widgets self. 
** What do you get? ** Keep everything in self, and your callers can set up any bindings they want. 
                       Currently bindings can be between a lens on data and a lens on a widget struct, or a lens on data and a BindableProperty. 
                       Critically, BindableProperties can call request_* methods. BindableProperties must be manually implemented currently. 

** Limitations ** Up in the air a bit. Bindings is currently only in my bindings-scroll branch and I haven't pushed it very far. 
                  Implementation will likely change.


# Speculation

I think the combination of Scope + Bindings does give us at least a 'full reactive' story : 
 
- Encapsulated reactive state is possible - app state does not need to be polluted. 
- The widget author no longer limits the reactivity choices of the Widgets consumers. 

However, I am not convinced it is the final picture at all - it is likely that this is scaffolding, 
enabling us to write more complete widgets and reveal fuller solutions that are less noisy and more integrated into the framework.

My current (half baked) thoughts of a possible future state:
  - Widget methods should be written independent of where state comes from, and the synchronisation to contexts, envs, or data  
    should be library/container provided. 
    - This means a separation of state synchronisation and 'everything else'.
    - Possibly this means most widget methods are always written in terms of self, 
      and never touch data or env - synchronisation should be provided 'elsewhere'.
  - Widget authors should declare in one place where their state comes from. 
    That might be a static binding to env, or defaulting to local state but overrideable by consumers to come from reactive state. 
  - Likely the widget struct grows a derive macro that allows helper annotations to describe this.
  - Dependency tracking is likely automatable. Possibly by an attribute macro on the widget impl that 
    tracks what in self is accessed in the requestable methods. 
