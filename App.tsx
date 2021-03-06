import * as React from 'react';
import {memo, PropsWithChildren} from 'react';
import {
  AppState,
  FlatList,
  ListRenderItemInfo,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {Card, CardData, feelings, findCard, needs} from './Data';
import Ionicons from '@expo/vector-icons/Ionicons';
import {Help} from './Help';
import DraggableFlatList from 'react-native-draggable-flatlist';

type CardProps = {
  card: Card;
  selected: boolean;
  onClick: (card: Card) => void;
  drag?: () => void;
  isDragging?: boolean;
};

const CardView = (props: CardProps) => {
  const card = props.card;

  const guessFontSize = (text: string): number => {
    if (text.length < 20) {
      return 1;
    } else if (text.length < 25) {
      return 2;
    } else {
      return 3;
    }
  };

  const getFontSize = (cardData: CardData): number => {
    const size = cardData.size ? cardData.size : guessFontSize(cardData.text);

    switch (size) {
      case 1:
        return 20;
      case 2:
        return 17;
      default:
        return 13;
    }
  };

  return (
      <TouchableOpacity
          onLongPress={props.drag}
          onPress={onPress}
          delayPressIn={50}
          style={[
            styles.card,
            props.selected &&
            (card.id.startsWith('n')
                ? styles.selectedNeed
                : styles.selectedFeeling),
          ]}>
        <View>
          {card.data.map((line, i) => {
            const fontSize = getFontSize(line);
            return (
                <Text style={[styles.cardText, {fontSize: fontSize}]} key={i}>
                  {line.text}
                </Text>
            );
          })}
        </View>
      </TouchableOpacity>
  );

  function onPress() {
    props.onClick(card);
  }
};

function arrayEquals(a: Array<string>, b: Array<string>) {
  return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((val, index) => val === b[index])
  );
}

type CardListProps = {
  cards: Card[];
  selectedCards: string[];
  onCardClick: (card: Card) => void;
};

const cardListChanged = (
    prevProps: Readonly<PropsWithChildren<CardListProps>>,
    nextProps: Readonly<PropsWithChildren<CardListProps>>,
): boolean => {
  return arrayEquals(prevProps.selectedCards, nextProps.selectedCards);
};

const CardList = memo((props: CardListProps) => {
  const {cards} = props;

  const isSelected = (item: Card): boolean => {
    return props.selectedCards.indexOf(item.id) !== -1;
  };

  const renderItem = (item: ListRenderItemInfo<Card>) => {
    const card = item.item;
    return (
        <CardView
            card={card}
            selected={isSelected(card)}
            onClick={props.onCardClick}
        />
    );
  };

  const key = (card: Card) => card.id;

  return (
      <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={cards}
          numColumns={1}
          keyExtractor={key}
          renderItem={renderItem}
      />
  );
}, cardListChanged);

type HidingCardListProps = CardListProps & {active: boolean};

const HidingCardList = (props: HidingCardListProps) => {
  const {active} = props;

  return (
      <View style={active ? styles.container : styles.hidden}>
        <CardList {...props} />
      </View>
  );
};

type SelectedCardListProps = CardListProps & {
  onCardDrag: (data: readonly Card[] | null) => void;
};

const SelectedCardList = memo((props: SelectedCardListProps) => {
  const isSelected = (item: Card): boolean =>
      props.selectedCards.indexOf(item.id) !== -1;

  return (
      <DraggableFlatList
          ListEmptyComponent={
            <Text style={[{textAlign: 'center'}, {marginTop: 20}]}>
              Nejsou vybr??ny ????dn?? karti??ky
            </Text>
          }
          contentInsetAdjustmentBehavior="automatic"
          data={props.cards}
          keyExtractor={(item) => item.id}
          renderItem={({item, index, drag, isActive}) => (
              <CardView
                  card={item}
                  selected={isSelected(item)}
                  onClick={() => props.onCardClick(item)}
                  drag={drag}
                  isDragging={isActive}
              />
          )}
          onDragEnd={({data}) => props.onCardDrag(data)}
      />
  );
}, cardListChanged);

type SelectedCardPanelProps = SelectedCardListProps & {active: boolean};

const SelectedCardPanel = (props: SelectedCardPanelProps) => {
  return (
      <View style={props.active ? styles.container : styles.hidden}>
        <SelectedCardList {...props} />
        {props.cards.length < 5 && props.cards.length > 0 && (
            <Text style={[{textAlign: 'center', margin: 10, color: 'grey'}]}>
              Pokud chcete zm??nit po??ad?? karti??ek, sta???? jednu z nich chv??li podr??et
              a pak p??esunout.
            </Text>
        )}
      </View>
  );
};

type NvcCardsAppProps = {};

type NvcCardsAppState = {
  activeScreen: string;
  selectedCards: string[];
};

const needsScreen = 'needs';
const feelingsScreen = 'feelings';
const selectionScreen = 'selection';
const helpScreen = 'help';

export default class App extends React.Component<
    NvcCardsAppProps,
    NvcCardsAppState
    > {
  constructor(props: NvcCardsAppProps) {
    super(props);
    this.state = {
      activeScreen: needsScreen,
      selectedCards: [],
    };
  }

  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);
    this.recoverState();
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.storeState();
    }
  };

  private storeState() {
    AsyncStorage.setItem('@last', JSON.stringify(this.state));
  }

  private recoverState() {
    AsyncStorage.getItem('@last').then((result) => {
      if (result != null) {
        this.setState(JSON.parse(result));
      }
    });
  }

  render() {
    const activeScreen = this.state.activeScreen;
    const selectedCards = this.state.selectedCards;
    const noCardsSelected = selectedCards.length === 0;
    const selectedCardsList: Card[] = this.getSelectedCardsList();

    return (
        <SafeAreaView style={{flex: 1}}>
          <View style={{flex: 100}}>
            <HidingCardList
                cards={needs}
                selectedCards={selectedCards}
                onCardClick={this.selectCard.bind(this)}
                active={activeScreen === needsScreen}
            />
            <HidingCardList
                cards={feelings}
                selectedCards={selectedCards}
                onCardClick={this.selectCard.bind(this)}
                active={activeScreen === feelingsScreen}
            />
            <SelectedCardPanel
                cards={selectedCardsList}
                selectedCards={selectedCards}
                onCardClick={this.selectCard.bind(this)}
                active={activeScreen === selectionScreen}
                onCardDrag={this.moveSelectedCard.bind(this)}
            />
            <Help active={activeScreen === helpScreen} />
          </View>
          <View style={styles.drawer}>
            {this.cardsButton('Pocity', feelingsScreen)}
            {this.cardsButton('Pot??eby', needsScreen)}
            {this.tabIcon(selectionScreen, 'list')}
            {this.tabIcon(helpScreen, 'help')}
            <View style={{flex: 1}}>
              <TouchableOpacity
                  onPress={() => this.share()}
                  style={styles.icon}
                  disabled={noCardsSelected}>
                <Ionicons name="share-social" size={20} style={[styles.inactiveText]} />
              </TouchableOpacity>
            </View>
            <View style={{flex: 1}}>
              <TouchableOpacity
                  onPress={() => this.setState({selectedCards: []})}
                  style={styles.icon}
                  disabled={noCardsSelected}>
                <Ionicons name="trash" size={20} style={[styles.inactiveText]} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
    );
  }

  private getSelectedCardsList() {
    return this.state.selectedCards.map((id) => findCard(id));
  }

  private cardsButton(title: String, screenName: string) {
    const active = this.state.activeScreen === screenName;
    return (
        <View style={[{flex: 2}, active && styles.activeButton]}>
          <TouchableOpacity
              onPress={() => this.setState({activeScreen: screenName})}
              disabled={active}
              style={styles.tabButton}>
            <Text
                style={[
                  styles.buttonText,
                  active ? styles.selectedButtonText : styles.inactiveText,
                ]}>
              {title}
            </Text>
          </TouchableOpacity>
        </View>
    );
  }

  private moveSelectedCard(data: readonly Card[] | null) {
    if (data != null) {
      this.setState({selectedCards: data.map((c) => c.id)});
    }
  }

  private selectCard(item: Card) {
    let selected = this.state.selectedCards;
    if (selected.indexOf(item.id) !== -1) {
      this.setState({selectedCards: selected.filter((id) => id !== item.id)});
    } else {
      this.setState({selectedCards: selected.concat([item.id])});
    }
  }

  private tabIcon(screenName: string, icon: 'list' | 'help') {
    const active = this.state.activeScreen === screenName;
    return (
        <View style={[{flex: 1}, active && styles.activeButton]}>
          <TouchableOpacity
              onPress={() => this.setState({activeScreen: screenName})}
              style={styles.icon}>
            <Ionicons
                name={icon}
                size={20}
                style={[styles.buttonText, !active && styles.inactiveText]}
            />
          </TouchableOpacity>
        </View>
    );
  }

  private async share() {
    try {
      const selectedCardsString = App.concatSelectedCards(
          this.getSelectedCardsList(),
      );
      await Share.share({
        message: selectedCardsString,
      });
    } catch (error) {}
  }

  private static concatSelectedCards(cards: Card[]) {
    return cards
        .map((card) => card.data.map((d) => d.text).join(', '))
        .map((text) => `- ${text}`)
        .join('\n');
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#d6d7da',
    height: 80,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  selectedNeed: {
    backgroundColor: '#d4ebf2',
  },
  selectedFeeling: {
    backgroundColor: '#f2dbd4',
  },
  item: {
    margin: 1,
    textAlign: 'center',
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedButtonText: {
    color: 'black',
  },
  activeButton: {
    borderTopWidth: 2,
  },
  buttonText: {
    fontSize: 20,
    color: 'black',
  },
  inactiveText: {
    color: 'grey',
  },
  icon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawer: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    borderWidth: 0,
    borderTopWidth: 1,
    borderColor: '#888',
  },
  hidden: {
    display: 'none',
  },
  cardText: {
    margin: 1,
    textAlign: 'center',
  },
});
